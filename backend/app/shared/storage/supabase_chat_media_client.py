from functools import lru_cache
from typing import Protocol

from supabase import Client, create_client

from app.config import settings


class ChatMediaStorageClient(Protocol):
    """Forma minima que necesita el dominio secretChatMedia de un backend de
    persistencia. Combina tabla + Storage (como StorageClient, ver
    supabase_client.py) porque una imagen/audio efimero SI necesita
    Storage para el contenido - a diferencia del Cofre de texto, que hasta
    ahora guardaba todo inline. Deliberadamente su propio Protocol en vez de
    reutilizar StorageClient: sin marca de "visto unico" ni contraseña,
    con TTL como unico mecanismo de expiracion - un contrato distinto."""

    def insert_media_item(self, record: dict) -> dict: ...
    def get_media_item(self, item_id: str) -> dict | None: ...
    def delete_media_item(self, item_id: str) -> None: ...
    def upload_file(self, path: str, content: bytes, content_type: str) -> None: ...
    def download_file(self, path: str) -> bytes: ...
    def delete_file(self, path: str) -> None: ...


class SupabaseChatMediaStorageClient:
    """Implementacion real sobre Supabase: Postgres para la tabla
    `secret_chat_media_items`, Storage para los bytes cifrados."""

    TABLE = "secret_chat_media_items"

    def __init__(self, url: str, key: str, bucket: str):
        self._client: Client = create_client(url, key)
        self._bucket = bucket

    def insert_media_item(self, record: dict) -> dict:
        response = self._client.table(self.TABLE).insert(record).execute()
        return response.data[0]

    def get_media_item(self, item_id: str) -> dict | None:
        response = self._client.table(self.TABLE).select("*").eq("id", item_id).limit(1).execute()
        return response.data[0] if response.data else None

    def delete_media_item(self, item_id: str) -> None:
        self._client.table(self.TABLE).delete().eq("id", item_id).execute()

    def upload_file(self, path: str, content: bytes, content_type: str) -> None:
        self._client.storage.from_(self._bucket).upload(path, content, {"content-type": content_type})

    def download_file(self, path: str) -> bytes:
        return self._client.storage.from_(self._bucket).download(path)

    def delete_file(self, path: str) -> None:
        self._client.storage.from_(self._bucket).remove([path])


@lru_cache
def get_chat_media_storage_client() -> ChatMediaStorageClient:
    # Perezoso, mismo criterio que get_storage_client/get_vault_storage_client:
    # los tests inyectan un FakeChatMediaStorageClient via
    # `app.dependency_overrides` (ver tests/conftest.py), esta funcion nunca
    # se llega a invocar durante pytest.
    return SupabaseChatMediaStorageClient(
        settings.supabase_url, settings.supabase_key, settings.secret_chat_media_bucket
    )
