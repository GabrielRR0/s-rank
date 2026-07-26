import io

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _create_text_share(text="hola mundo", password=None, expires_in_minutes=60):
    data = {"content_type": "text", "text": text, "expires_in_minutes": str(expires_in_minutes)}
    if password:
        data["password"] = password
    return client.post("/api/shared-content", data=data)


def test_crear_share_de_texto_devuelve_201_con_id_y_url():
    print("\n[test] POST /api/shared-content (texto)...")
    response = _create_text_share()

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["url_path"] == f"/s/{body['id']}"
    print(f"[test] OK: status 201, id: {body['id']}")


def test_crear_share_de_archivo_devuelve_201():
    print("\n[test] POST /api/shared-content (archivo)...")
    files = {"file": ("nota.txt", io.BytesIO(b"contenido del archivo"), "text/plain")}
    data = {"content_type": "file", "expires_in_minutes": "60"}

    response = client.post("/api/shared-content", data=data, files=files)

    assert response.status_code == 201
    print(f"[test] OK: status 201, id: {response.json()['id']}")


def test_archivo_mayor_a_10mb_es_rechazado_con_mensaje_claro():
    print("\n[test] POST /api/shared-content con archivo > 10MB...")
    big_content = b"a" * 10_000_001
    files = {"file": ("grande.bin", io.BytesIO(big_content), "application/octet-stream")}
    data = {"content_type": "file", "expires_in_minutes": "60"}

    response = client.post("/api/shared-content", data=data, files=files)

    # 413 si el body entero (archivo + overhead multipart) ya supera
    # MAX_BODY_BYTES en el middleware, 422 si lo frena antes el chequeo
    # explicito de MAX_FILE_BYTES en el servicio - cualquiera de los dos es
    # un rechazo correcto, lo que importa es que no sea 201.
    assert response.status_code in (413, 422)
    print(f"[test] OK: status {response.status_code} como se esperaba.")


def test_archivo_ejecutable_es_rechazado_con_mensaje_claro():
    print("\n[test] POST /api/shared-content con un .exe...")
    files = {"file": ("actualizacion.exe", io.BytesIO(b"MZ..."), "application/octet-stream")}
    data = {"content_type": "file", "expires_in_minutes": "60"}

    response = client.post("/api/shared-content", data=data, files=files)

    assert response.status_code == 422
    assert "no esta permitido" in response.json()["detail"] or "no está permitido" in response.json()["detail"]
    print("[test] OK: status 422, tipo de archivo peligroso rechazado.")


def test_expiracion_no_permitida_devuelve_422():
    print("\n[test] POST /api/shared-content con expires_in_minutes invalido...")
    response = _create_text_share(expires_in_minutes=999)

    assert response.status_code == 422
    print("[test] OK: status 422 como se esperaba.")


def test_get_status_de_share_inexistente_devuelve_exists_false():
    print("\n[test] GET /api/shared-content/{id} con id inexistente...")
    response = client.get("/api/shared-content/no-existe")

    assert response.status_code == 200
    assert response.json()["exists"] is False
    print("[test] OK: exists=false como se esperaba.")


def test_get_status_no_consume_la_vista():
    print("\n[test] GET /api/shared-content/{id} no quema la vista unica...")
    share_id = _create_text_share().json()["id"]

    client.get(f"/api/shared-content/{share_id}")
    status_despues = client.get(f"/api/shared-content/{share_id}")

    assert status_despues.json()["exists"] is True
    print("[test] OK: el segundo GET todavia ve el share como disponible.")


def test_get_status_de_share_con_password_indica_requires_password():
    print("\n[test] GET status de un share protegido con contraseña...")
    share_id = _create_text_share(password="secreta123").json()["id"]

    response = client.get(f"/api/shared-content/{share_id}")

    assert response.json() == {
        "exists": True,
        "requires_password": True,
        "content_type": "text",
        "file_name": None,
    }
    print("[test] OK: requires_password=true, sin revelar contenido.")


def test_get_status_de_archivo_con_password_oculta_el_nombre():
    print("\n[test] GET status de un archivo protegido con contraseña...")
    files = {"file": ("contrato_confidencial.pdf", io.BytesIO(b"contenido"), "application/pdf")}
    data = {"content_type": "file", "expires_in_minutes": "60", "password": "secreta123"}
    share_id = client.post("/api/shared-content", data=data, files=files).json()["id"]

    response = client.get(f"/api/shared-content/{share_id}")

    assert response.json()["file_name"] is None
    print("[test] OK: file_name oculto - no se filtra el nombre antes de verificar la contraseña.")


def test_get_status_de_archivo_sin_password_muestra_el_nombre():
    print("\n[test] GET status de un archivo sin contraseña...")
    files = {"file": ("vacaciones.jpg", io.BytesIO(b"contenido"), "image/jpeg")}
    data = {"content_type": "file", "expires_in_minutes": "60"}
    share_id = client.post("/api/shared-content", data=data, files=files).json()["id"]

    response = client.get(f"/api/shared-content/{share_id}")

    assert response.json()["file_name"] == "vacaciones.jpg"
    print("[test] OK: sin contraseña, el nombre si se muestra.")


def test_reveal_sin_password_devuelve_el_texto():
    print("\n[test] POST /api/shared-content/{id}/reveal (texto, sin password)...")
    share_id = _create_text_share(text="secreto").json()["id"]

    response = client.post(f"/api/shared-content/{share_id}/reveal", json={})

    assert response.status_code == 200
    assert response.json()["text"] == "secreto"
    print("[test] OK: contenido revelado correctamente.")


def test_reveal_segunda_vez_devuelve_410():
    print("\n[test] POST /api/shared-content/{id}/reveal dos veces seguidas...")
    share_id = _create_text_share().json()["id"]

    primero = client.post(f"/api/shared-content/{share_id}/reveal", json={})
    segundo = client.post(f"/api/shared-content/{share_id}/reveal", json={})

    assert primero.status_code == 200
    assert segundo.status_code == 410
    print("[test] OK: segundo intento devolvio 410 (vista unica respetada).")


def test_reveal_con_password_incorrecta_devuelve_401_sin_revelar_ni_quemar_vista():
    print("\n[test] POST reveal con password incorrecta, despues con la correcta...")
    share_id = _create_text_share(text="secreto", password="correcta123").json()["id"]

    incorrecta = client.post(f"/api/shared-content/{share_id}/reveal", json={"password": "incorrecta"})
    assert incorrecta.status_code == 401
    assert "secreto" not in incorrecta.text

    correcta = client.post(f"/api/shared-content/{share_id}/reveal", json={"password": "correcta123"})
    assert correcta.status_code == 200
    assert correcta.json()["text"] == "secreto"
    print("[test] OK: password incorrecta rechazada sin quemar la vista; la correcta funciono despues.")


def test_reveal_de_share_inexistente_devuelve_410():
    print("\n[test] POST reveal con id inexistente...")
    response = client.post("/api/shared-content/no-existe/reveal", json={})

    assert response.status_code == 410
    print("[test] OK: status 410 como se esperaba.")


def test_reveal_de_archivo_devuelve_el_binario_con_content_disposition():
    print("\n[test] POST reveal de un share de archivo...")
    files = {"file": ("foto.png", io.BytesIO(b"\x89PNG..."), "image/png")}
    data = {"content_type": "file", "expires_in_minutes": "60"}
    share_id = client.post("/api/shared-content", data=data, files=files).json()["id"]

    response = client.post(f"/api/shared-content/{share_id}/reveal", json={})

    assert response.status_code == 200
    assert response.content == b"\x89PNG..."
    assert "foto.png" in response.headers["content-disposition"]
    # Content-Type original preservado (no el generico octet-stream) y
    # disposition "inline" para imagenes, asi el frontend puede mostrarla
    # directo en un <img> en vez de forzar una descarga.
    assert response.headers["content-type"] == "image/png"
    assert response.headers["content-disposition"].startswith("inline")
    print("[test] OK: binario devuelto con el content-type original y disposition inline.")
