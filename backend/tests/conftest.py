import base64
import os
from datetime import datetime, timezone

import pytest

from app.config import settings
from app.core.rate_limit import limiter
from app.main import app
from app.shared.storage.supabase_client import get_storage_client


class FakeStorageClient:
    """Doble en memoria de StorageClient (ver app/shared/storage/supabase_client.py).

    Permite testear el flujo completo de sharedContent sin un proyecto de
    Supabase real. La unica pieza que realmente importa replicar con
    cuidado es `mark_viewed_if_unseen`: debe devolver la fila a UN solo
    llamador cuando hay accesos consecutivos sobre el mismo id, igual que
    el UPDATE...WHERE viewed_at IS NULL real en Postgres.
    """

    def __init__(self):
        self.rows: dict[str, dict] = {}
        self.files: dict[str, bytes] = {}

    def insert_share(self, record: dict) -> dict:
        self.rows[record["id"]] = dict(record)
        return dict(record)

    def get_share(self, share_id: str) -> dict | None:
        row = self.rows.get(share_id)
        return dict(row) if row is not None else None

    def mark_viewed_if_unseen(self, share_id: str) -> dict | None:
        row = self.rows.get(share_id)
        if row is None or row.get("viewed_at") is not None:
            return None
        row["viewed_at"] = datetime.now(timezone.utc).isoformat()
        return dict(row)

    def increment_failed_attempts(self, share_id: str) -> int:
        row = self.rows.get(share_id)
        if row is None:
            return 0
        row["failed_password_attempts"] = row.get("failed_password_attempts", 0) + 1
        return row["failed_password_attempts"]

    def delete_share_row(self, share_id: str) -> None:
        self.rows.pop(share_id, None)

    def upload_file(self, path: str, content: bytes, content_type: str) -> None:
        self.files[path] = content

    def download_file(self, path: str) -> bytes:
        return self.files[path]

    def delete_file(self, path: str) -> None:
        self.files.pop(path, None)


@pytest.fixture
def fake_client():
    return FakeStorageClient()


@pytest.fixture(autouse=True)
def _override_storage_client(fake_client):
    # Reemplaza el cliente real de Supabase por el fake en memoria para
    # TODOS los tests que pegan a la app via TestClient (routers). Los
    # tests de servicio/seguridad instancian su propio FakeStorageClient()
    # y lo pasan directo, sin pasar por este override.
    app.dependency_overrides[get_storage_client] = lambda: fake_client
    yield
    app.dependency_overrides.pop(get_storage_client, None)


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # El limiter vive en app.state y persiste durante toda la sesion de
    # pytest (el modulo app.main se importa una sola vez); sin resetearlo
    # entre tests, el orden en que corren los archivos de test afectaria si
    # se dispara un 429 o no.
    limiter.reset()
    yield


@pytest.fixture(autouse=True)
def _test_encryption_key(monkeypatch):
    # create_share/reveal_share encriptan/desencriptan de verdad (no hay un
    # "fake" para esto, es logica pura sin dependencia externa) - los tests
    # necesitan una clave con el formato correcto para poder ejercitar ese
    # camino. No hace falta que sea la clave real de ningun despliegue. Los
    # tests que prueban especificamente el caso de clave faltante/invalida
    # (ver security/test_encryption.py) la pisan puntualmente con su propio
    # monkeypatch, que gana sobre este porque corre despues.
    monkeypatch.setattr(settings, "master_encryption_key", base64.b64encode(os.urandom(32)).decode())
