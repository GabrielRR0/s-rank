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


def test_nonce_vacio_devuelve_422():
    print("\n[test] POST /api/secret-chat-media con nonce vacio...")
    response = _create_media_item(nonce="")

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_room_id_con_caracteres_de_path_traversal_no_rompe_el_servidor():
    # A diferencia de secretChatAuth (que valida room_id como UUID antes de
    # usarlo para nada), este endpoint recibe room_id como string libre de
    # multipart y lo concatena directo en storage_path (ver
    # secret_chat_media_service.create_media_item: f"{room_id}/{item_id}").
    # No hay forma de "escapar" fuera del bucket con esto (Supabase Storage
    # trata "/" como separador logico de key, no como filesystem real), pero
    # documenta que este campo puntual no tiene NINGUNA validacion de
    # formato server-side, a diferencia de room_id en /api/secret-chat/*.
    print("\n[test] POST /api/secret-chat-media con room_id conteniendo '../' ...")
    response = _create_media_item(room_id="../../../etc/passwd")

    assert response.status_code == 201
    print("[test] Confirmado: se acepta tal cual (sin validar formato) - no rompe el server, pero tampoco lo valida.")


def test_mime_svg_es_aceptado_hoy():
    # Hallazgo de seguridad a señalar, no un bug de test: ALLOWED_CHAT_MEDIA_MIME_PREFIXES
    # = ("image/", "audio/") es un chequeo de PREFIJO nomas - "image/svg+xml"
    # matchea "image/" igual que "image/png", aunque un SVG puede llevar
    # <script> embebido (a diferencia de sharedContent, que sí tiene una
    # blocklist explicita para tipos peligrosos, ver
    # services/sharedContent/security/blocked_file_types.py). Este test
    # documenta el comportamiento ACTUAL (lo acepta), no lo aprueba.
    print("\n[test] POST /api/secret-chat-media con mime_type='image/svg+xml' (podria llevar <script>)...")
    response = _create_media_item(mime_type="image/svg+xml")

    assert response.status_code == 201
    print("[test] Confirmado: se acepta hoy - ver nota de seguridad en el docstring de este test.")
