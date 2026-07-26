from datetime import datetime, timezone
from functools import lru_cache
from typing import Protocol

from supabase import Client, create_client

from app.config import settings


class StorageClient(Protocol):
    """Forma minima que necesita el dominio sharedContent de un backend de
    persistencia. Permite testear services/routers con un fake en memoria
    (ver tests/conftest.py) sin depender de un proyecto de Supabase real."""

    def insert_share(self, record: dict) -> dict: ...
    def get_share(self, share_id: str) -> dict | None: ...
    def mark_viewed_if_unseen(self, share_id: str) -> dict | None: ...
    def delete_share_row(self, share_id: str) -> None: ...
    def upload_file(self, path: str, content: bytes, content_type: str) -> None: ...
    def download_file(self, path: str) -> bytes: ...
    def delete_file(self, path: str) -> None: ...


class SupabaseStorageClient:
    """Implementacion real sobre Supabase: Postgres (via PostgREST) para la
    tabla `shared_content`, Storage para los archivos."""

    TABLE = "shared_content"

    def __init__(self, url: str, key: str, bucket: str):
        self._client: Client = create_client(url, key)
        self._bucket = bucket

    def insert_share(self, record: dict) -> dict:
        response = self._client.table(self.TABLE).insert(record).execute()
        return response.data[0]

    def get_share(self, share_id: str) -> dict | None:
        response = self._client.table(self.TABLE).select("*").eq("id", share_id).limit(1).execute()
        return response.data[0] if response.data else None

    def mark_viewed_if_unseen(self, share_id: str) -> dict | None:
        # UPDATE ... WHERE id = ? AND viewed_at IS NULL, una sola sentencia
        # SQL (PostgREST traduce esta cadena de filtros a un unico UPDATE,
        # no a un SELECT+UPDATE separados desde Python). Postgres resuelve
        # la fila con lock a nivel de fila: si dos requests casi
        # simultaneas llegan aca, una gana el UPDATE y la otra ya no
        # encuentra `viewed_at IS NULL` cierto (la transaccion, en
        # read-committed, vuelve a evaluar el WHERE), asi que su
        # `response.data` le queda vacio. Esto es lo que hace atomica la
        # "visualizacion unica" sin necesitar un lock explicito en Python.
        response = (
            self._client.table(self.TABLE)
            .update({"viewed_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", share_id)
            .is_("viewed_at", "null")
            .execute()
        )
        return response.data[0] if response.data else None

    def delete_share_row(self, share_id: str) -> None:
        self._client.table(self.TABLE).delete().eq("id", share_id).execute()

    def upload_file(self, path: str, content: bytes, content_type: str) -> None:
        self._client.storage.from_(self._bucket).upload(path, content, {"content-type": content_type})

    def download_file(self, path: str) -> bytes:
        return self._client.storage.from_(self._bucket).download(path)

    def delete_file(self, path: str) -> None:
        self._client.storage.from_(self._bucket).remove([path])


@lru_cache
def get_storage_client() -> StorageClient:
    # Construccion perezosa (recien en el primer uso real, no al importar
    # este modulo): si se instanciara a nivel de modulo, importar app.main
    # sin SUPABASE_URL/KEY configuradas (ej. al correr pytest en una maquina
    # nueva antes de crear el proyecto de Supabase) rompería la coleccion de
    # tests. Los tests nunca llaman a esta funcion - inyectan un
    # FakeStorageClient via `app.dependency_overrides` (ver tests/conftest.py).
    return SupabaseStorageClient(settings.supabase_url, settings.supabase_key, settings.supabase_storage_bucket)
