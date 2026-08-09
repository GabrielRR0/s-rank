from functools import lru_cache
from typing import Protocol

from supabase import Client, create_client

from app.config import settings


class VaultStorageClient(Protocol):
    """Forma minima que necesita el dominio secretVault de un backend de
    persistencia. Deliberadamente separado de StorageClient (ver
    app/shared/storage/supabase_client.py): las operaciones no comparten
    nada real (un contador atomico de copias vs. una marca de vista unica),
    asi que compartir una sola interfaz solo agregaria acoplamiento sin
    beneficio. Permite testear el service con un fake en memoria (ver
    tests/conftest.py) sin depender de un proyecto de Supabase real."""

    def insert_vault_item(self, record: dict) -> dict: ...
    def get_vault_item(self, item_id: str) -> dict | None: ...
    def decrement_copies_if_available(self, item_id: str) -> dict | None: ...
    def delete_vault_item(self, item_id: str) -> None: ...
    # Las 3 de abajo solo las usan items con content_type != "text" (ver
    # secret_vault_service.create_vault_media_item/get_vault_item) - un
    # Cofre de texto corto sigue sin tocar Storage para nada, igual que
    # siempre.
    def upload_file(self, path: str, content: bytes, content_type: str) -> None: ...
    def download_file(self, path: str) -> bytes: ...
    def delete_file(self, path: str) -> None: ...


class SupabaseVaultStorageClient:
    """Implementacion real sobre Supabase Postgres (via PostgREST/RPC) +
    Storage (solo para items de imagen/audio, ver arriba)."""

    TABLE = "secret_vault_items"

    def __init__(self, url: str, key: str, bucket: str):
        self._client: Client = create_client(url, key)
        self._bucket = bucket

    def insert_vault_item(self, record: dict) -> dict:
        response = self._client.table(self.TABLE).insert(record).execute()
        return response.data[0]

    def get_vault_item(self, item_id: str) -> dict | None:
        response = self._client.table(self.TABLE).select("*").eq("id", item_id).limit(1).execute()
        return response.data[0] if response.data else None

    def decrement_copies_if_available(self, item_id: str) -> dict | None:
        # No un .update() con un valor precalculado en Python: eso requeriria
        # leer remaining_copies, restar 1, y mandar ese numero como el nuevo
        # valor - dos requests concurrentes pueden leer el mismo numero antes
        # de que cualquiera escriba, y la segunda escritura pisa a la
        # primera (under-count real, no solo teorico). En cambio, esta RPC
        # ejecuta "SET remaining_copies = remaining_copies - 1" como una
        # unica sentencia SQL dentro de Postgres, que resuelve la fila con
        # lock a nivel de fila - la logica de "restar" corre atomicamente en
        # la base, nunca en Python. Ver backend/README.md para el SQL de la
        # funcion `decrement_vault_copies`.
        response = self._client.rpc("decrement_vault_copies", {"item_id": item_id}).execute()
        return response.data[0] if response.data else None

    def delete_vault_item(self, item_id: str) -> None:
        self._client.table(self.TABLE).delete().eq("id", item_id).execute()

    def upload_file(self, path: str, content: bytes, content_type: str) -> None:
        self._client.storage.from_(self._bucket).upload(path, content, {"content-type": content_type})

    def download_file(self, path: str) -> bytes:
        return self._client.storage.from_(self._bucket).download(path)

    def delete_file(self, path: str) -> None:
        self._client.storage.from_(self._bucket).remove([path])


@lru_cache
def get_vault_storage_client() -> VaultStorageClient:
    # Perezoso, mismo criterio que get_storage_client: si se instanciara al
    # importar el modulo, correr pytest sin SUPABASE_URL/KEY configuradas
    # rompería la coleccion de tests. Los tests inyectan un
    # FakeVaultStorageClient via `app.dependency_overrides` (ver tests/conftest.py).
    return SupabaseVaultStorageClient(settings.supabase_url, settings.supabase_key, settings.supabase_vault_media_bucket)
