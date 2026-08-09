import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def _room_id() -> str:
    return str(uuid.uuid4())


def test_crear_sala_con_password_devuelve_201_con_tokens():
    print("\n[test] POST /api/secret-chat/rooms...")
    response = client.post(
        "/api/secret-chat/rooms",
        json={"room_id": _room_id(), "password": "correcta123"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["session_token"]
    print("[test] OK: status 201 con ambos tokens.")


def test_crear_sala_duplicada_devuelve_409():
    print("\n[test] POST /api/secret-chat/rooms dos veces con el mismo room_id...")
    room_id = _room_id()
    client.post("/api/secret-chat/rooms", json={"room_id": room_id, "password": "correcta123"})

    response = client.post("/api/secret-chat/rooms", json={"room_id": room_id, "password": "otra"})

    assert response.status_code == 409
    print("[test] OK: status 409 como se esperaba.")


def test_realtime_token_para_sala_sin_password_devuelve_200():
    print("\n[test] POST /api/secret-chat/realtime-token para una sala sin contraseña...")
    response = client.post("/api/secret-chat/realtime-token", json={"room_id": _room_id()})

    assert response.status_code == 200
    assert response.json()["access_token"]
    print("[test] OK: status 200 con access_token.")


def test_realtime_token_para_sala_con_password_correcta_devuelve_200():
    print("\n[test] POST /api/secret-chat/realtime-token con la contraseña correcta...")
    room_id = _room_id()
    client.post("/api/secret-chat/rooms", json={"room_id": room_id, "password": "correcta123"})

    response = client.post(
        "/api/secret-chat/realtime-token", json={"room_id": room_id, "password": "correcta123"}
    )

    assert response.status_code == 200
    print("[test] OK: status 200.")


def test_realtime_token_para_sala_con_password_incorrecta_devuelve_401():
    print("\n[test] POST /api/secret-chat/realtime-token con contraseña incorrecta...")
    room_id = _room_id()
    client.post("/api/secret-chat/rooms", json={"room_id": room_id, "password": "correcta123"})

    response = client.post(
        "/api/secret-chat/realtime-token", json={"room_id": room_id, "password": "incorrecta"}
    )

    assert response.status_code == 401
    print("[test] OK: status 401 como se esperaba.")


def test_realtime_token_con_room_id_invalido_devuelve_422():
    print("\n[test] POST /api/secret-chat/realtime-token con room_id mal formado...")
    response = client.post("/api/secret-chat/realtime-token", json={"room_id": "no-es-un-uuid"})

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_refresh_con_session_token_valido_devuelve_200():
    print("\n[test] POST /api/secret-chat/realtime-token/refresh...")
    room_id = _room_id()
    inicial = client.post("/api/secret-chat/realtime-token", json={"room_id": room_id}).json()

    response = client.post(
        "/api/secret-chat/realtime-token/refresh",
        json={"room_id": room_id, "session_token": inicial["session_token"]},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
    print("[test] OK: status 200 con access_token nuevo.")


def test_refresh_con_session_token_invalido_devuelve_401():
    print("\n[test] POST /api/secret-chat/realtime-token/refresh con session_token invalido...")
    response = client.post(
        "/api/secret-chat/realtime-token/refresh",
        json={"room_id": _room_id(), "session_token": "basura"},
    )

    assert response.status_code == 401
    print("[test] OK: status 401 como se esperaba.")


def test_realtime_token_con_turnstile_prendido_sin_token_devuelve_422(monkeypatch):
    print("\n[test] POST /api/secret-chat/realtime-token con TURNSTILE_ENABLED=True y sin token...")
    monkeypatch.setattr(settings, "turnstile_enabled", True)

    response = client.post("/api/secret-chat/realtime-token", json={"room_id": _room_id()})

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_bot_guard_bloquea_tras_fallos_repetidos_de_turnstile(monkeypatch):
    print("\n[test] varios fallos de Turnstile seguidos disparan el bloqueo de bot_guard...")
    monkeypatch.setattr(settings, "turnstile_enabled", True)
    monkeypatch.setattr(settings, "bot_guard_max_failures", 3)
    monkeypatch.setattr(settings, "rate_limit_realtime_token", "1000/minute")

    for intento in range(3):
        respuesta = client.post("/api/secret-chat/realtime-token", json={"room_id": _room_id()})
        assert respuesta.status_code == 422
        print(f"[test]   intento {intento + 1}/3 rechazado por Turnstile (422).")

    respuesta_bloqueada = client.post("/api/secret-chat/realtime-token", json={"room_id": _room_id()})
    assert respuesta_bloqueada.status_code == 429
    print("[test] OK: 4to intento devolvio 429 (bloqueado por IP), sin llegar a evaluar Turnstile.")
