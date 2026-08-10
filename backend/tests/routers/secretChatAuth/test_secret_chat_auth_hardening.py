import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def _room_id() -> str:
    return str(uuid.uuid4())


def test_crear_sala_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] POST /api/secret-chat/rooms mas alla de RATE_LIMIT_REALTIME_ROOMS ({settings.rate_limit_realtime_rooms})...")
    limit = int(settings.rate_limit_realtime_rooms.split("/")[0])

    for i in range(limit):
        response = client.post(
            "/api/secret-chat/rooms", json={"room_id": _room_id(), "password": "correcta123"}
        )
        assert response.status_code == 201, f"request {i + 1} deberia pasar bajo el limite"

    response = client.post("/api/secret-chat/rooms", json={"room_id": _room_id(), "password": "correcta123"})
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_realtime_token_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] POST /api/secret-chat/realtime-token mas alla de RATE_LIMIT_REALTIME_TOKEN ({settings.rate_limit_realtime_token})...")
    limit = int(settings.rate_limit_realtime_token.split("/")[0])

    for i in range(limit):
        response = client.post("/api/secret-chat/realtime-token", json={"room_id": _room_id()})
        assert response.status_code == 200, f"request {i + 1} deberia pasar bajo el limite"

    response = client.post("/api/secret-chat/realtime-token", json={"room_id": _room_id()})
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_refresh_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] POST /api/secret-chat/realtime-token/refresh mas alla de RATE_LIMIT_REALTIME_REFRESH ({settings.rate_limit_realtime_refresh})...")
    limit = int(settings.rate_limit_realtime_refresh.split("/")[0])
    room_id = _room_id()
    session_token = client.post("/api/secret-chat/realtime-token", json={"room_id": room_id}).json()["session_token"]

    for i in range(limit):
        response = client.post(
            "/api/secret-chat/realtime-token/refresh",
            json={"room_id": room_id, "session_token": session_token},
        )
        assert response.status_code == 200, f"request {i + 1} deberia pasar bajo el limite"

    response = client.post(
        "/api/secret-chat/realtime-token/refresh",
        json={"room_id": room_id, "session_token": session_token},
    )
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_post_con_body_gigante_responde_413():
    print("\n[test] POST /api/secret-chat/rooms con body > MAX_BODY_BYTES...")
    response = client.post(
        "/api/secret-chat/rooms",
        json={"room_id": _room_id(), "password": "a" * (settings.max_body_bytes + 5000)},
    )

    assert response.status_code == 413
    print("[test] OK: status 413 como se esperaba.")


def test_respuesta_incluye_headers_de_seguridad():
    print("\n[test] POST /api/secret-chat/realtime-token trae headers de seguridad...")
    response = client.post("/api/secret-chat/realtime-token", json={"room_id": _room_id()})

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "max-age" in response.headers["strict-transport-security"]
    print("[test] OK: headers de seguridad presentes, incluyendo Strict-Transport-Security.")


def test_origin_no_permitido_responde_403():
    print("\n[test] POST /api/secret-chat/realtime-token con header Origin de un sitio no permitido...")
    response = client.post(
        "/api/secret-chat/realtime-token",
        json={"room_id": _room_id()},
        headers={"Origin": "https://sitio-malicioso.com"},
    )

    assert response.status_code == 403
    print("[test] OK: status 403 como se esperaba.")


def test_origin_permitido_no_es_bloqueado():
    print("\n[test] POST /api/secret-chat/realtime-token con Origin del frontend de desarrollo...")
    response = client.post(
        "/api/secret-chat/realtime-token",
        json={"room_id": _room_id()},
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == 200
    print("[test] OK: status 200, el origen permitido no fue bloqueado.")
