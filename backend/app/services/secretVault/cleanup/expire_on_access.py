from datetime import datetime, timezone

from app.services.secretVault.errors import VaultUnavailableError
from app.shared.storage.supabase_vault_client import VaultStorageClient


def is_expired(item: dict) -> bool:
    expires_at = item["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    return datetime.now(timezone.utc) >= expires_at


def purge_item(item_id: str, client: VaultStorageClient) -> None:
    """Borra fisicamente la fila - nunca un soft delete. Los items de texto
    no tienen archivo en Storage que borrar (ciphertext va inline en la
    fila); los de imagen/audio si (ver secret_vault_service.create_vault_media_item) -
    se intenta borrar el archivo primero por las dudas, sin fallar si ya no
    existe (idempotente, mismo criterio que el resto de este archivo)."""
    item = client.get_vault_item(item_id)
    if item and item.get("storage_path"):
        client.delete_file(item["storage_path"])
    client.delete_vault_item(item_id)


def raise_if_expired(item: dict, client: VaultStorageClient) -> None:
    """Chequeo on-demand, mismo criterio que sharedContent (regla del
    portafolio: cero colas/workers 24/7). Un item que expira y nadie vuelve
    a pedirlo simplemente queda en Supabase hasta el proximo intento de
    acceso, que lo detecta y lo purga recien ahi."""
    if is_expired(item):
        purge_item(item["id"], client)
        raise VaultUnavailableError(f"El item del cofre '{item['id']}' expiro.")
