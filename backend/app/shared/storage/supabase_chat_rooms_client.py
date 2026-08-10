from functools import lru_cache
from typing import Protocol

from supabase import Client, create_client

from app.config import settings


class ChatRoomStorageClient(Protocol):
    """Forma minima que necesita secretChatAuth de un backend de
    persistencia. Deliberadamente separado de StorageClient/VaultStorageClient
    (ver supabase_client.py/supabase_vault_client.py): las operaciones no
    comparten nada real (una fila por sala con password vs. contenido de
    shares/items del Cofre) - mismo criterio de aislamiento por dominio ya
    establecido en este proyecto."""

    def insert_room(self, record: dict) -> dict: ...
    def get_room(self, room_id: str) -> dict | None: ...
    def delete_room(self, room_id: str) -> None: ...


class SupabaseChatRoomStorageClient:
    TABLE = "secret_chat_rooms"

    def __init__(self, url: str, key: str):
        self._client: Client = create_client(url, key)

    def insert_room(self, record: dict) -> dict:
        response = self._client.table(self.TABLE).insert(record).execute()
        return response.data[0]

    def get_room(self, room_id: str) -> dict | None:
        response = self._client.table(self.TABLE).select("*").eq("id", room_id).limit(1).execute()
        return response.data[0] if response.data else None

    def delete_room(self, room_id: str) -> None:
        self._client.table(self.TABLE).delete().eq("id", room_id).execute()


@lru_cache
def get_chat_room_storage_client() -> ChatRoomStorageClient:
    # Perezoso, mismo criterio que get_storage_client/get_vault_storage_client:
    # los tests inyectan un fake via `app.dependency_overrides` (ver tests/conftest.py),
    # esta funcion nunca llega a invocarse durante pytest.
    return SupabaseChatRoomStorageClient(settings.supabase_url, settings.supabase_key)
