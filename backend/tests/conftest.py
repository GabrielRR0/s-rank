import base64
import os
import threading
from datetime import datetime, timezone

import pytest
from postgrest.exceptions import APIError

from app.config import settings
from app.core.rate_limit import limiter
from app.main import app
from app.services.secretChatAuth import bot_guard
from app.shared.storage.supabase_chat_media_client import get_chat_media_storage_client
from app.shared.storage.supabase_chat_rooms_client import get_chat_room_storage_client
from app.shared.storage.supabase_client import get_storage_client
from app.shared.storage.supabase_vault_client import get_vault_storage_client


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


class FakeVaultStorageClient:
    """Doble en memoria de VaultStorageClient (ver
    app/shared/storage/supabase_vault_client.py).

    `decrement_copies_if_available` implementa la resta en Python plano -
    alcanza para probar el *contrato* (agotamiento secuencial correcto), no
    concurrencia real: la garantia atomica real la da Postgres via la
    funcion `decrement_vault_copies` (ver backend/README.md seccion 12), y
    eso solo se puede probar contra una base real, no contra este fake
    (mismo criterio que ya admite esta clase hermana para
    mark_viewed_if_unseen).
    """

    def __init__(self):
        self.rows: dict[str, dict] = {}
        self.files: dict[str, bytes] = {}
        # Real Postgres da esta atomicidad gratis via un UPDATE...WHERE de
        # una sola fila (ver decrement_vault_copies, backend/README.md
        # seccion 12) - un dict de Python no. Sin este lock, un test que
        # dispara copies en paralelo con threads reales (ver
        # tests/routers/secretVault/test_concurrency.py) podria colar mas
        # de un "exito" para el mismo item con remaining_copies=1: el GIL
        # puede cambiar de thread entre el chequeo de arriba y el -= 1 de
        # abajo (mas todavia con multiples statements de por medio). El
        # lock hace que este fake replique la MISMA garantia atomica que ya
        # se documenta como real en Postgres, en vez de solo confiar en que
        # el GIL "probablemente" no cambie de thread en el momento justo.
        self._lock = threading.Lock()

    def insert_vault_item(self, record: dict) -> dict:
        self.rows[record["id"]] = dict(record)
        return dict(record)

    def get_vault_item(self, item_id: str) -> dict | None:
        row = self.rows.get(item_id)
        return dict(row) if row is not None else None

    def decrement_copies_if_available(self, item_id: str) -> dict | None:
        with self._lock:
            row = self.rows.get(item_id)
            if row is None or row.get("remaining_copies", 0) <= 0:
                return None
            expires_at = row["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if datetime.now(timezone.utc) >= expires_at:
                return None
            row["remaining_copies"] -= 1
            return dict(row)

    def delete_vault_item(self, item_id: str) -> None:
        self.rows.pop(item_id, None)

    def upload_file(self, path: str, content: bytes, content_type: str) -> None:
        self.files[path] = content

    def download_file(self, path: str) -> bytes:
        return self.files[path]

    def delete_file(self, path: str) -> None:
        self.files.pop(path, None)


@pytest.fixture
def fake_vault_client():
    return FakeVaultStorageClient()


@pytest.fixture(autouse=True)
def _override_vault_storage_client(fake_vault_client):
    app.dependency_overrides[get_vault_storage_client] = lambda: fake_vault_client
    yield
    app.dependency_overrides.pop(get_vault_storage_client, None)


class FakeChatRoomStorageClient:
    """Doble en memoria de ChatRoomStorageClient (ver
    app/shared/storage/supabase_chat_rooms_client.py). `insert_room` lanza
    `postgrest.exceptions.APIError` ante un id duplicado, igual que la
    violacion de unique constraint real en Postgres - asi
    create_room_with_password ejercita el mismo camino de traduccion a
    RoomAlreadyExistsError que usaria contra Supabase real."""

    def __init__(self):
        self.rows: dict[str, dict] = {}
        # Mismo motivo que el lock de FakeVaultStorageClient: replicar bajo
        # threads reales la atomicidad que el unique constraint de Postgres
        # da gratis (ver tests/routers/secretVault/test_concurrency.py).
        self._lock = threading.Lock()

    def insert_room(self, record: dict) -> dict:
        with self._lock:
            if record["id"] in self.rows:
                raise APIError({"message": "duplicate key value violates unique constraint", "code": "23505"})
            self.rows[record["id"]] = dict(record)
            return dict(record)

    def get_room(self, room_id: str) -> dict | None:
        row = self.rows.get(room_id)
        return dict(row) if row is not None else None

    def delete_room(self, room_id: str) -> None:
        self.rows.pop(room_id, None)


@pytest.fixture
def fake_chat_room_client():
    return FakeChatRoomStorageClient()


@pytest.fixture(autouse=True)
def _override_chat_room_storage_client(fake_chat_room_client):
    app.dependency_overrides[get_chat_room_storage_client] = lambda: fake_chat_room_client
    yield
    app.dependency_overrides.pop(get_chat_room_storage_client, None)


class FakeChatMediaStorageClient:
    """Doble en memoria de ChatMediaStorageClient (ver
    app/shared/storage/supabase_chat_media_client.py) - combina fila +
    Storage, mismo criterio que FakeStorageClient."""

    def __init__(self):
        self.rows: dict[str, dict] = {}
        self.files: dict[str, bytes] = {}

    def insert_media_item(self, record: dict) -> dict:
        self.rows[record["id"]] = dict(record)
        return dict(record)

    def get_media_item(self, item_id: str) -> dict | None:
        row = self.rows.get(item_id)
        return dict(row) if row is not None else None

    def delete_media_item(self, item_id: str) -> None:
        self.rows.pop(item_id, None)

    def upload_file(self, path: str, content: bytes, content_type: str) -> None:
        self.files[path] = content

    def download_file(self, path: str) -> bytes:
        return self.files[path]

    def delete_file(self, path: str) -> None:
        self.files.pop(path, None)


@pytest.fixture
def fake_chat_media_client():
    return FakeChatMediaStorageClient()


@pytest.fixture(autouse=True)
def _override_chat_media_storage_client(fake_chat_media_client):
    app.dependency_overrides[get_chat_media_storage_client] = lambda: fake_chat_media_client
    yield
    app.dependency_overrides.pop(get_chat_media_storage_client, None)


@pytest.fixture(autouse=True)
def _reset_bot_guard():
    bot_guard.reset()
    yield


@pytest.fixture(autouse=True)
def _test_jwt_secret(monkeypatch):
    # mint_initial_tokens/create_room_with_password/refresh_access_token
    # firman/decodifican JWT de verdad - necesitan un secreto con el que
    # operar. No hace falta que sea el secreto real de ningun despliegue.
    monkeypatch.setattr(settings, "supabase_jwt_secret", "secreto-de-prueba-para-tests-con-largo-de-sobra")


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # El limiter vive en app.state y persiste durante toda la sesion de
    # pytest (el modulo app.main se importa una sola vez); sin resetearlo
    # entre tests, el orden en que corren los archivos de test afectaria si
    # se dispara un 429 o no.
    limiter.reset()
    yield


@pytest.fixture(autouse=True)
def _turnstile_disabled_by_default(monkeypatch):
    # Mismo motivo que _test_jwt_secret/_test_encryption_key: los tests no
    # deben depender de lo que diga el .env real en este momento (ej. que
    # alguien active Turnstile en desarrollo) - por defecto queda apagado
    # para toda la coleccion, y los tests que puntualmente prueban el
    # camino "activado" ya lo pisan con su propio monkeypatch(turnstile_enabled=True),
    # que gana por correr despues (ver test_secret_chat_auth_router.py y
    # tests/shared/security/test_turnstile.py).
    monkeypatch.setattr(settings, "turnstile_enabled", False)
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
