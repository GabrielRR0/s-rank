from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def _create_media_item(room_id="sala-1", nonce="nonce-b64", mime_type="image/png", ttl_seconds=60, content=b"bytes-cifrados"):
    return client.post(
        "/api/secret-chat-media",
        data={"room_id": room_id, "nonce": nonce, "mime_type": mime_type, "ttl_seconds": str(ttl_seconds)},
        files={"ciphertext_file": ("ciphertext.bin", content, "application/octet-stream")},
    )


def test_crear_item_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] POST /api/secret-chat-media mas alla de RATE_LIMIT_CHAT_MEDIA_CREATE ({settings.rate_limit_chat_media_create})...")
    limit = int(settings.rate_limit_chat_media_create.split("/")[0])

    for i in range(limit):
        response = _create_media_item()
        assert response.status_code == 201, f"request {i + 1} deberia pasar bajo el limite"

    response = _create_media_item()
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_get_status_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] GET /api/secret-chat-media/{{id}} mas alla de RATE_LIMIT_CHAT_MEDIA_STATUS ({settings.rate_limit_chat_media_status})...")
    limit = int(settings.rate_limit_chat_media_status.split("/")[0])

    for i in range(limit):
        response = client.get("/api/secret-chat-media/no-existe")
        assert response.status_code == 410, f"request {i + 1} deberia pasar bajo el limite"

    response = client.get("/api/secret-chat-media/no-existe")
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_post_con_body_gigante_responde_413():
    print("\n[test] POST /api/secret-chat-media con archivo > MAX_BODY_BYTES...")
    response = _create_media_item(content=b"a" * (settings.max_body_bytes + 5000))

    assert response.status_code == 413
    print("[test] OK: status 413 como se esperaba.")


def test_respuesta_incluye_headers_de_seguridad():
    print("\n[test] GET /api/secret-chat-media/{id} trae headers de seguridad...")
    response = client.get("/api/secret-chat-media/no-existe")

    assert response.status_code == 410
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "max-age" in response.headers["strict-transport-security"]
    print("[test] OK: headers de seguridad presentes, incluyendo Strict-Transport-Security.")


def test_origin_no_permitido_responde_403():
    print("\n[test] GET /api/secret-chat-media/{id} con header Origin de un sitio no permitido...")
    response = client.get("/api/secret-chat-media/no-existe", headers={"Origin": "https://sitio-malicioso.com"})

    assert response.status_code == 403
    print("[test] OK: status 403 como se esperaba.")


def test_origin_permitido_no_es_bloqueado():
    print("\n[test] GET /api/secret-chat-media/{id} con Origin del frontend de desarrollo...")
    response = client.get("/api/secret-chat-media/no-existe", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 410
    print("[test] OK: status 410 (no 403), el origen permitido no fue bloqueado.")
