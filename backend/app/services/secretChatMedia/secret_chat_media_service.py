import base64
import uuid
from datetime import datetime, timedelta, timezone

from app.schemas.secretChatMedia.secret_chat_media_schemas import (
    ALLOWED_CHAT_MEDIA_MIME_PREFIXES,
    ALLOWED_CHAT_MEDIA_TTL_SECONDS,
    ChatMediaItemResponse,
    CreateChatMediaItemResponse,
)
from app.services.secretChatMedia.cleanup.expire_on_access import raise_if_expired
from app.services.secretChatMedia.errors import ChatMediaUnavailableError
from app.shared.storage.supabase_chat_media_client import ChatMediaStorageClient


def create_media_item(
    room_id: str,
    nonce: str,
    mime_type: str,
    ttl_seconds: int,
    ciphertext_bytes: bytes,
    max_bytes: int,
    client: ChatMediaStorageClient,
) -> CreateChatMediaItemResponse:
    if ttl_seconds not in ALLOWED_CHAT_MEDIA_TTL_SECONDS:
        raise ValueError("ttl_seconds no permitido.")
    if not mime_type.startswith(ALLOWED_CHAT_MEDIA_MIME_PREFIXES):
        raise ValueError("mime_type debe ser de imagen o audio.")
    if not nonce or not ciphertext_bytes:
        raise ValueError("Falta el contenido o el nonce.")
    if len(ciphertext_bytes) > max_bytes:
        raise ValueError("El archivo es demasiado grande.")

    item_id = str(uuid.uuid4())
    storage_path = f"{room_id}/{item_id}"
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    # Igual que el resto de este archivo: el backend nunca ve el contenido
    # real, solo bytes ya cifrados en el navegador con la clave de la sala
    # (fragmento de la URL, nunca enviado a este backend).
    client.upload_file(storage_path, ciphertext_bytes, "application/octet-stream")
    client.insert_media_item(
        {
            "id": item_id,
            "room_id": room_id,
            "storage_path": storage_path,
            "nonce": nonce,
            "mime_type": mime_type,
            "byte_size": len(ciphertext_bytes),
            "expires_at": expires_at.isoformat(),
        }
    )

    return CreateChatMediaItemResponse(id=item_id, expires_at=expires_at)


def get_media_item(item_id: str, client: ChatMediaStorageClient) -> ChatMediaItemResponse:
    """Sin limite de copias (a diferencia del Cofre): todos los ocupantes
    conectados a la sala (hasta 6) necesitan poder pedir este mismo item
    dentro de la ventana del TTL - purgar tras la primera lectura los
    dejaria a los demas sin poder verlo."""
    item = client.get_media_item(item_id)
    if item is None:
        raise ChatMediaUnavailableError(f"El contenido multimedia '{item_id}' no existe.")

    raise_if_expired(item, client)

    ciphertext_bytes = client.download_file(item["storage_path"])
    ciphertext_b64url = base64.urlsafe_b64encode(ciphertext_bytes).decode("ascii").rstrip("=")

    return ChatMediaItemResponse(
        id=item["id"],
        ciphertext=ciphertext_b64url,
        nonce=item["nonce"],
        mime_type=item["mime_type"],
        expires_at=item["expires_at"],
    )
