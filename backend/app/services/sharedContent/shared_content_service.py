import uuid
from datetime import datetime, timedelta, timezone

from app.schemas.sharedContent.shared_content_schemas import (
    ALLOWED_EXPIRATIONS_MINUTES,
    CreateShareResponse,
    RevealedText,
    ShareStatus,
)
from app.services.sharedContent.cleanup.expire_on_access import purge_share, raise_if_expired
from app.services.sharedContent.errors import ShareUnauthorizedError, ShareUnavailableError
from app.services.sharedContent.security.one_time_access import consume_view
from app.services.sharedContent.security.password_hash import hash_password, verify_password
from app.shared.storage.supabase_client import StorageClient


def create_share(
    content_type: str,
    text: str | None,
    file_bytes: bytes | None,
    file_name: str | None,
    file_mime_type: str | None,
    password: str | None,
    expires_in_minutes: int,
    max_file_bytes: int,
    client: StorageClient,
) -> CreateShareResponse:
    if content_type not in ("text", "file"):
        raise ValueError("content_type debe ser 'text' o 'file'.")
    if expires_in_minutes not in ALLOWED_EXPIRATIONS_MINUTES:
        raise ValueError("Duracion de expiracion no permitida.")

    share_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)

    record = {
        "id": share_id,
        "content_type": content_type,
        "content_text": None,
        "storage_path": None,
        "file_name": None,
        "file_size": None,
        "file_type": None,
        # Solo se guarda el hash - jamas la contraseña en texto plano.
        "password_hash": hash_password(password) if password else None,
        "expires_at": expires_at.isoformat(),
        "viewed_at": None,
    }

    if content_type == "text":
        if not text or not text.strip():
            raise ValueError("El texto a compartir no puede estar vacio.")
        record["content_text"] = text
    else:
        # El texto plano se guarda directo en Postgres (arriba); solo los
        # archivos reales pasan por Supabase Storage - evita un viaje a
        # Storage por pegar dos lineas de texto.
        if not file_bytes:
            raise ValueError("Falta el archivo a compartir.")
        if len(file_bytes) > max_file_bytes:
            raise ValueError(f"El archivo supera el maximo de {max_file_bytes // 1_000_000}MB.")
        mime_type = file_mime_type or "application/octet-stream"
        storage_path = f"{share_id}/{file_name or 'archivo'}"
        client.upload_file(storage_path, file_bytes, mime_type)
        record["storage_path"] = storage_path
        record["file_name"] = file_name
        record["file_size"] = len(file_bytes)
        record["file_type"] = mime_type

    client.insert_share(record)

    return CreateShareResponse(id=share_id, url_path=f"/s/{share_id}", expires_at=expires_at)


def get_share_status(share_id: str, client: StorageClient) -> ShareStatus:
    """Lectura segura: nunca consume la vista unica ni revela el contenido -
    solo dice si el link todavia sirve y si hace falta contraseña (para que
    ViewContent.vue sepa que UI mostrar antes de pedirle una accion
    explicita al usuario, ver security/README.md)."""
    share = client.get_share(share_id)
    if share is None:
        return ShareStatus(exists=False)

    try:
        raise_if_expired(share, client)
    except ShareUnavailableError:
        return ShareStatus(exists=False)

    if share.get("viewed_at") is not None:
        return ShareStatus(exists=False)

    return ShareStatus(
        exists=True,
        requires_password=share.get("password_hash") is not None,
        content_type=share["content_type"],
        file_name=share.get("file_name"),
    )


def reveal_share(share_id: str, password: str | None, client: StorageClient) -> RevealedText | tuple[bytes, str, str]:
    """Devuelve el contenido y quema la vista unica en el proceso.

    Devuelve `RevealedText` para texto, o una tupla (bytes, nombre_archivo,
    mime) para archivos - se diferencia asi, en vez de con un Union de
    schemas Pydantic, porque el archivo viaja como `Response` binario crudo
    (igual que el PDF en contract-generator), no como JSON. Ver
    routers/sharedContent/shared_content_router.py.
    """
    share = client.get_share(share_id)
    if share is None:
        raise ShareUnavailableError(f"El contenido '{share_id}' no existe.")

    raise_if_expired(share, client)

    password_hash = share.get("password_hash")
    if password_hash is not None:
        # Se valida ANTES de consumir la vista unica - ver
        # security/README.md para el motivo (un intento fallido, o un bot
        # de previsualizacion de enlaces, no debe dejar afuera al
        # destinatario real).
        if not password or not verify_password(password, password_hash):
            raise ShareUnauthorizedError("Contraseña incorrecta.")

    viewed_share = consume_view(share_id, client)

    if viewed_share["content_type"] == "text":
        content = viewed_share["content_text"]
        purge_share(viewed_share, client)
        return RevealedText(text=content)

    file_bytes = client.download_file(viewed_share["storage_path"])
    file_name = viewed_share.get("file_name") or "archivo"
    mime_type = viewed_share.get("file_type") or "application/octet-stream"
    purge_share(viewed_share, client)
    return file_bytes, file_name, mime_type
