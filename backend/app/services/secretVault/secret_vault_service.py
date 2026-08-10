import base64
import uuid
from datetime import datetime, timedelta, timezone

from app.schemas.secretVault.secret_vault_schemas import (
    ALLOWED_VAULT_MAX_COPIES,
    ALLOWED_VAULT_MEDIA_CONTENT_TYPES,
    ALLOWED_VAULT_TTL_SECONDS,
    CreateVaultItemResponse,
    VaultItemResponse,
)
from app.services.secretVault.cleanup.expire_on_access import purge_item, raise_if_expired
from app.services.secretVault.errors import VaultUnavailableError
from app.shared.storage.supabase_vault_client import VaultStorageClient


def create_vault_item(
    ciphertext: str,
    nonce: str,
    max_copies: int,
    ttl_seconds: int,
    room_id: str | None,
    client: VaultStorageClient,
) -> CreateVaultItemResponse:
    if max_copies not in ALLOWED_VAULT_MAX_COPIES:
        raise ValueError("max_copies debe estar entre 1 y 6.")
    if ttl_seconds not in ALLOWED_VAULT_TTL_SECONDS:
        raise ValueError("ttl_seconds no permitido.")
    if not ciphertext or not nonce:
        raise ValueError("Falta ciphertext o nonce.")

    item_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    record = {
        "id": item_id,
        "room_id": room_id,
        # Ya cifrado en el cliente con la clave de la sala (fragmento de la
        # URL, nunca enviada a este backend) - este servicio nunca ve ni
        # necesita el plaintext, solo administra el contador y el TTL. Ver
        # frontend/src/services/secretChat/crypto.service.ts.
        "ciphertext": ciphertext,
        "nonce": nonce,
        "max_copies": max_copies,
        "remaining_copies": max_copies,
        "expires_at": expires_at.isoformat(),
    }
    client.insert_vault_item(record)

    return CreateVaultItemResponse(id=item_id, expires_at=expires_at)


def create_vault_media_item(
    content_type: str,
    mime_type: str,
    max_copies: int,
    ttl_seconds: int,
    nonce: str,
    ciphertext_bytes: bytes,
    max_bytes: int,
    room_id: str | None,
    client: VaultStorageClient,
) -> CreateVaultItemResponse:
    if max_copies not in ALLOWED_VAULT_MAX_COPIES:
        raise ValueError("max_copies debe estar entre 1 y 6.")
    if ttl_seconds not in ALLOWED_VAULT_TTL_SECONDS:
        raise ValueError("ttl_seconds no permitido.")
    if content_type not in ALLOWED_VAULT_MEDIA_CONTENT_TYPES:
        raise ValueError("content_type debe ser 'image' o 'audio'.")
    # No alcanza con chequear que mime_type sea ALGUN tipo de imagen/audio -
    # tiene que corresponder puntualmente al content_type declarado (ej.
    # content_type="image" con mime_type="audio/webm" debe rechazarse).
    if not mime_type.startswith(f"{content_type}/"):
        raise ValueError("mime_type no corresponde al content_type.")
    if not nonce or not ciphertext_bytes:
        raise ValueError("Falta el contenido o el nonce.")
    if len(ciphertext_bytes) > max_bytes:
        raise ValueError("El archivo es demasiado grande.")

    item_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    # Mismo motivo que create_vault_item para el texto: el backend nunca ve
    # el contenido real, solo bytes ya cifrados en el navegador con la
    # clave de la sala. A diferencia del texto, que va inline en la fila,
    # esto se sube a Storage - un secreto de texto corto entra comodo en
    # una columna de Postgres, una foto/audio no.
    client.upload_file(item_id, ciphertext_bytes, "application/octet-stream")

    record = {
        "id": item_id,
        "room_id": room_id,
        "ciphertext": None,
        "nonce": nonce,
        "max_copies": max_copies,
        "remaining_copies": max_copies,
        "expires_at": expires_at.isoformat(),
        "content_type": content_type,
        "storage_path": item_id,
        "mime_type": mime_type,
    }
    client.insert_vault_item(record)

    return CreateVaultItemResponse(id=item_id, expires_at=expires_at)


def get_vault_item(item_id: str, client: VaultStorageClient) -> VaultItemResponse:
    """Ver el item no esta limitado (solo copiarlo lo esta, ver
    consume_copy) - a diferencia de sharedContent no hay un paso separado de
    "reveal", este es el unico GET que devuelve contenido."""
    item = client.get_vault_item(item_id)
    if item is None:
        raise VaultUnavailableError(f"El item del cofre '{item_id}' no existe.")

    raise_if_expired(item, client)

    if item["remaining_copies"] <= 0:
        purge_item(item_id, client)
        raise VaultUnavailableError(f"El item del cofre '{item_id}' ya agoto sus copias.")

    # Items de imagen/audio guardan el ciphertext en Storage, no inline
    # (ver create_vault_media_item) - se descarga y se codifica en
    # base64url para devolverlo en el mismo campo `ciphertext` de siempre,
    # sin necesitar un endpoint de streaming binario aparte.
    if item.get("content_type", "text") != "text":
        ciphertext_bytes = client.download_file(item["storage_path"])
        item = {**item, "ciphertext": base64.urlsafe_b64encode(ciphertext_bytes).decode("ascii").rstrip("=")}

    return VaultItemResponse(**item)


def consume_copy(item_id: str, client: VaultStorageClient) -> VaultItemResponse:
    """Decrementa el contador de copias de forma atomica (ver
    SupabaseVaultStorageClient.decrement_copies_if_available) y devuelve la
    fila resultante. Si llega a 0, se autodestruye en el mismo request - no
    hace falta un round-trip extra ni un worker para eso."""
    item = client.get_vault_item(item_id)
    if item is None:
        raise VaultUnavailableError(f"El item del cofre '{item_id}' no existe.")
    raise_if_expired(item, client)

    row = client.decrement_copies_if_available(item_id)
    if row is None:
        # La RPC no encontro una fila que cumpla remaining_copies > 0 AND
        # expires_at > now() - alguien mas la agoto o expiro entre el
        # raise_if_expired de arriba y esta llamada. Se purga por las dudas
        # (idempotente si ya no existe) y se informa igual que cualquier
        # otro caso "ya no disponible".
        purge_item(item_id, client)
        raise VaultUnavailableError(f"El item del cofre '{item_id}' ya no esta disponible.")

    if row["remaining_copies"] <= 0:
        purge_item(item_id, client)

    return VaultItemResponse(**row)
