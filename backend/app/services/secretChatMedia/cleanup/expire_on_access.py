from datetime import datetime, timezone

from app.services.secretChatMedia.errors import ChatMediaUnavailableError
from app.shared.storage.supabase_chat_media_client import ChatMediaStorageClient


def is_expired(item: dict) -> bool:
    expires_at = item["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    return datetime.now(timezone.utc) >= expires_at


def purge_item(item_id: str, storage_path: str, client: ChatMediaStorageClient) -> None:
    """Borra fisicamente el archivo de Storage y la fila - nunca un soft
    delete. Mismo criterio on-demand que secretVault/sharedContent: sin
    worker/cron, se purga recien en el proximo acceso."""
    client.delete_file(storage_path)
    client.delete_media_item(item_id)


def raise_if_expired(item: dict, client: ChatMediaStorageClient) -> None:
    if is_expired(item):
        purge_item(item["id"], item["storage_path"], client)
        raise ChatMediaUnavailableError(f"El contenido multimedia '{item['id']}' ya no esta disponible.")
