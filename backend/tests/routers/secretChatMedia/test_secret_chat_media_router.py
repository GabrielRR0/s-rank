import base64

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


def test_crear_item_de_media_devuelve_201_con_id_y_expiracion():
    print("\n[test] POST /api/secret-chat-media...")
    response = _create_media_item()

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["expires_at"]
    print(f"[test] OK: status 201, id: {body['id']}")


def test_get_item_de_media_devuelve_el_contenido_decodificable():
    print("\n[test] GET /api/secret-chat-media/{id}...")
    item_id = _create_media_item(content=b"contenido-real").json()["id"]

    response = client.get(f"/api/secret-chat-media/{item_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["mime_type"] == "image/png"
    assert base64.urlsafe_b64decode(body["ciphertext"] + "==") == b"contenido-real"
    print("[test] OK: el contenido original se recupera decodificando la respuesta.")


def test_get_item_de_media_inexistente_devuelve_410():
    print("\n[test] GET /api/secret-chat-media/{id} con id inexistente...")
    response = client.get("/api/secret-chat-media/no-existe")

    assert response.status_code == 410
    print("[test] OK: status 410 como se esperaba.")


def test_ttl_no_permitido_devuelve_422():
    print("\n[test] POST /api/secret-chat-media con ttl_seconds invalido...")
    response = _create_media_item(ttl_seconds=999)

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_mime_type_no_permitido_devuelve_422():
    print("\n[test] POST /api/secret-chat-media con mime_type que no es imagen/audio...")
    response = _create_media_item(mime_type="application/pdf")

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_archivo_demasiado_grande_devuelve_422(monkeypatch):
    print("\n[test] POST /api/secret-chat-media con archivo mas grande que el limite...")
    monkeypatch.setattr(settings, "chat_media_max_bytes", 10)

    response = _create_media_item(content=b"esto-es-mas-largo-que-10-bytes")

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_get_multiples_veces_no_consume_nada():
    print("\n[test] GET /api/secret-chat-media/{id} repetido (sin limite de copias)...")
    item_id = _create_media_item().json()["id"]

    primera = client.get(f"/api/secret-chat-media/{item_id}")
    segunda = client.get(f"/api/secret-chat-media/{item_id}")

    assert primera.status_code == 200
    assert segunda.status_code == 200
    print("[test] OK: a diferencia del Cofre, leerlo varias veces no lo agota.")
