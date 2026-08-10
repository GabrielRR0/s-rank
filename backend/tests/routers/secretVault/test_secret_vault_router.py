import base64

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def _create_vault_item(max_copies=3, ttl_seconds=60, ciphertext="cifrado-b64", nonce="nonce-b64"):
    body = {"ciphertext": ciphertext, "nonce": nonce, "max_copies": max_copies, "ttl_seconds": ttl_seconds}
    return client.post("/api/secret-vault", json=body)


def test_crear_item_del_cofre_devuelve_201_con_id_y_expiracion():
    print("\n[test] POST /api/secret-vault...")
    response = _create_vault_item()

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["expires_at"]
    print(f"[test] OK: status 201, id: {body['id']}")


def test_max_copies_fuera_de_rango_devuelve_422():
    print("\n[test] POST /api/secret-vault con max_copies=7...")
    response = _create_vault_item(max_copies=7)

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_ttl_no_permitido_devuelve_422():
    print("\n[test] POST /api/secret-vault con ttl_seconds=999...")
    response = _create_vault_item(ttl_seconds=999)

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_get_item_devuelve_el_ciphertext_y_los_contadores():
    print("\n[test] GET /api/secret-vault/{id}...")
    item_id = _create_vault_item(ciphertext="xyz", max_copies=4).json()["id"]

    response = client.get(f"/api/secret-vault/{item_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["ciphertext"] == "xyz"
    assert body["max_copies"] == 4
    assert body["remaining_copies"] == 4
    print("[test] OK: el backend devuelve el ciphertext tal cual, sin descifrarlo.")


def test_get_item_de_texto_devuelve_content_type_text_explicito():
    # Regresion puntual: un item creado por el endpoint de texto plano
    # (POST /api/secret-vault, sin pasar por /media) tiene que reportar
    # content_type "text" en la respuesta - el frontend (VaultCard.vue)
    # decide si mostrar texto, imagen o audio en base a este campo, y un
    # valor faltante/incorrecto ahi hizo que un secreto de texto se
    # terminara mostrando como reproductor de audio.
    print("\n[test] GET /api/secret-vault/{id} de un item de TEXTO reporta content_type='text'...")
    item_id = _create_vault_item(ciphertext="un-secreto-de-texto").json()["id"]

    response = client.get(f"/api/secret-vault/{item_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["content_type"] == "text"
    assert body["mime_type"] is None
    print("[test] OK: content_type='text', mime_type=None, como corresponde a un item de texto.")


def test_get_item_inexistente_devuelve_410():
    print("\n[test] GET /api/secret-vault/{id} con id inexistente...")
    response = client.get("/api/secret-vault/no-existe")

    assert response.status_code == 410
    print("[test] OK: status 410 como se esperaba.")


def test_copiar_decrementa_el_contador_y_lo_devuelve():
    print("\n[test] POST /api/secret-vault/{id}/copy...")
    item_id = _create_vault_item(max_copies=2).json()["id"]

    response = client.post(f"/api/secret-vault/{item_id}/copy")

    assert response.status_code == 200
    assert response.json()["remaining_copies"] == 1
    print("[test] OK: quedo 1 copia restante.")


def test_copiar_hasta_agotar_y_despues_devuelve_410():
    print("\n[test] POST /api/secret-vault/{id}/copy hasta agotar max_copies=1...")
    item_id = _create_vault_item(max_copies=1).json()["id"]

    primera = client.post(f"/api/secret-vault/{item_id}/copy")
    segunda = client.post(f"/api/secret-vault/{item_id}/copy")

    assert primera.status_code == 200
    assert primera.json()["remaining_copies"] == 0
    assert segunda.status_code == 410
    print("[test] OK: primera copia consumida (200), segunda ya no disponible (410).")

    estado = client.get(f"/api/secret-vault/{item_id}")
    assert estado.status_code == 410
    print("[test] OK: el GET tambien confirma que el item ya no existe.")


def test_ciphertext_demasiado_grande_devuelve_422():
    print("\n[test] POST /api/secret-vault con ciphertext gigante...")
    response = _create_vault_item(ciphertext="a" * 20_000)

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba (VAULT_MAX_CIPHERTEXT_BYTES).")


def _create_vault_media_item(content_type="image", mime_type="image/png", max_copies=3, ttl_seconds=60, content=b"bytes-cifrados", nonce="nonce-b64"):
    return client.post(
        "/api/secret-vault/media",
        data={
            "content_type": content_type,
            "mime_type": mime_type,
            "max_copies": str(max_copies),
            "ttl_seconds": str(ttl_seconds),
            "nonce": nonce,
        },
        files={"ciphertext_file": ("ciphertext.bin", content, "application/octet-stream")},
    )


def test_crear_item_de_imagen_del_cofre_devuelve_201():
    print("\n[test] POST /api/secret-vault/media con una imagen...")
    response = _create_vault_media_item()

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["expires_at"]
    print(f"[test] OK: status 201, id: {body['id']}")


def test_get_item_de_imagen_devuelve_el_contenido_decodificable():
    print("\n[test] GET /api/secret-vault/{id} de un item de imagen...")
    item_id = _create_vault_media_item(content=b"contenido-real-de-la-imagen").json()["id"]

    response = client.get(f"/api/secret-vault/{item_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["content_type"] == "image"
    assert body["mime_type"] == "image/png"
    assert base64.urlsafe_b64decode(body["ciphertext"] + "==") == b"contenido-real-de-la-imagen"
    print("[test] OK: el contenido original se recupera decodificando la respuesta.")


def test_content_type_invalido_en_media_devuelve_422():
    print("\n[test] POST /api/secret-vault/media con content_type invalido...")
    response = _create_vault_media_item(content_type="video")

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_content_type_que_no_coincide_con_mime_type_devuelve_422():
    # Alguien (o un cliente modificado) declara content_type="image" pero
    # manda un mime_type de audio - no alcanza con que mime_type sea ALGUN
    # tipo permitido, tiene que corresponder al content_type declarado (ver
    # secret_vault_service.create_vault_media_item).
    print("\n[test] POST /api/secret-vault/media con content_type='image' pero mime_type='audio/mp3'...")
    response = _create_vault_media_item(content_type="image", mime_type="audio/mp3")

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_archivo_de_media_demasiado_grande_devuelve_422(monkeypatch):
    print("\n[test] POST /api/secret-vault/media con archivo mas grande que el limite...")
    monkeypatch.setattr(settings, "vault_media_max_bytes", 10)

    response = _create_vault_media_item(content=b"esto-es-mas-largo-que-10-bytes")

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")
