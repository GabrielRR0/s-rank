import pytest

from app.schemas.sharedContent.shared_content_schemas import RevealedText
from app.services.sharedContent import shared_content_service
from app.services.sharedContent.errors import ShareUnauthorizedError, ShareUnavailableError

MAX_FILE_BYTES = 10_000_000
MAX_PASSWORD_ATTEMPTS = 8


def _create_text(client, text="hola", password=None, expires_in_minutes=60):
    return shared_content_service.create_share(
        content_type="text",
        text=text,
        file_bytes=None,
        file_name=None,
        file_mime_type=None,
        password=password,
        expires_in_minutes=expires_in_minutes,
        max_file_bytes=MAX_FILE_BYTES,
        client=client,
    )


def _reveal(client, share_id, password=None, max_attempts=MAX_PASSWORD_ATTEMPTS):
    return shared_content_service.reveal_share(share_id, password, client, max_attempts)


def test_create_share_de_texto_guarda_el_contenido_encriptado(fake_client):
    print("\n[test] create_share con content_type='text' guarda el contenido encriptado...")
    result = _create_text(fake_client, text="hola")

    stored = fake_client.get_share(result.id)
    assert stored["content_text"] != "hola"
    assert stored["encryption_nonce"]
    revelado = _reveal(fake_client, result.id)
    assert revelado.text == "hola"
    print("[test] OK: el valor guardado no es el texto plano, y reveal_share si devuelve el original.")


def test_create_share_con_expiracion_no_permitida_lanza_value_error(fake_client):
    print("\n[test] create_share con expires_in_minutes invalido...")
    with pytest.raises(ValueError):
        _create_text(fake_client, expires_in_minutes=999)
    print("[test] OK: lanzo ValueError.")


def test_create_share_de_archivo_que_supera_el_limite_lanza_value_error(fake_client):
    print("\n[test] create_share con archivo > max_file_bytes...")
    with pytest.raises(ValueError):
        shared_content_service.create_share(
            content_type="file",
            text=None,
            file_bytes=b"a" * 100,
            file_name="x.bin",
            file_mime_type="application/octet-stream",
            password=None,
            expires_in_minutes=60,
            max_file_bytes=50,
            client=fake_client,
        )
    print("[test] OK: lanzo ValueError.")


def test_create_share_de_archivo_con_extension_peligrosa_lanza_value_error(fake_client):
    print("\n[test] create_share con un archivo .exe...")
    with pytest.raises(ValueError):
        shared_content_service.create_share(
            content_type="file",
            text=None,
            file_bytes=b"MZ...",
            file_name="actualizacion.exe",
            file_mime_type="application/octet-stream",
            password=None,
            expires_in_minutes=60,
            max_file_bytes=MAX_FILE_BYTES,
            client=fake_client,
        )
    print("[test] OK: lanzo ValueError.")


def test_create_share_de_archivo_sanitiza_el_nombre(fake_client):
    print("\n[test] create_share con un nombre de archivo con path traversal...")
    result = shared_content_service.create_share(
        content_type="file",
        text=None,
        file_bytes=b"contenido",
        file_name="../../otro-share/secreto.txt",
        file_mime_type="text/plain",
        password=None,
        expires_in_minutes=60,
        max_file_bytes=MAX_FILE_BYTES,
        client=fake_client,
    )

    stored = fake_client.get_share(result.id)
    assert stored["file_name"] == "secreto.txt"
    assert stored["storage_path"] == f"{result.id}/secreto.txt"
    print(f"[test] OK: nombre sanitizado a '{stored['file_name']}'.")


def test_get_share_status_de_share_inexistente(fake_client):
    print("\n[test] get_share_status con id inexistente...")
    status = shared_content_service.get_share_status("no-existe", fake_client)

    assert status.exists is False
    print("[test] OK: exists=False.")


def test_get_share_status_oculta_file_name_si_requiere_password(fake_client):
    print("\n[test] get_share_status de un archivo con contraseña...")
    result = shared_content_service.create_share(
        content_type="file",
        text=None,
        file_bytes=b"contenido",
        file_name="contrato.pdf",
        file_mime_type="application/pdf",
        password="secreta123",
        expires_in_minutes=60,
        max_file_bytes=MAX_FILE_BYTES,
        client=fake_client,
    )

    status = shared_content_service.get_share_status(result.id, fake_client)

    assert status.requires_password is True
    assert status.file_name is None
    print("[test] OK: file_name oculto hasta verificar la contraseña.")


def test_get_share_status_muestra_file_name_sin_password(fake_client):
    print("\n[test] get_share_status de un archivo sin contraseña...")
    result = shared_content_service.create_share(
        content_type="file",
        text=None,
        file_bytes=b"contenido",
        file_name="foto.png",
        file_mime_type="image/png",
        password=None,
        expires_in_minutes=60,
        max_file_bytes=MAX_FILE_BYTES,
        client=fake_client,
    )

    status = shared_content_service.get_share_status(result.id, fake_client)

    assert status.file_name == "foto.png"
    print("[test] OK: sin contraseña, el nombre del archivo si se muestra.")


def test_reveal_share_devuelve_texto_y_lo_borra_despues(fake_client):
    print("\n[test] reveal_share con texto...")
    created = _create_text(fake_client, text="secreto")

    result = _reveal(fake_client, created.id)

    assert isinstance(result, RevealedText)
    assert result.text == "secreto"
    assert fake_client.get_share(created.id) is None
    print("[test] OK: contenido devuelto y fila purgada.")


def test_reveal_share_de_archivo_desencripta_los_bytes_originales(fake_client):
    print("\n[test] reveal_share con archivo...")
    original = b"\x89PNG contenido binario de prueba"
    created = shared_content_service.create_share(
        content_type="file",
        text=None,
        file_bytes=original,
        file_name="foto.png",
        file_mime_type="image/png",
        password=None,
        expires_in_minutes=60,
        max_file_bytes=MAX_FILE_BYTES,
        client=fake_client,
    )

    file_bytes, file_name, mime_type = _reveal(fake_client, created.id)

    assert file_bytes == original
    assert file_name == "foto.png"
    assert mime_type == "image/png"
    print("[test] OK: los bytes desencriptados coinciden con el archivo original.")


def test_reveal_share_con_password_incorrecta_lanza_unauthorized_sin_purgar(fake_client):
    print("\n[test] reveal_share con password incorrecta...")
    created = _create_text(fake_client, text="secreto", password="correcta123")

    with pytest.raises(ShareUnauthorizedError):
        _reveal(fake_client, created.id, "incorrecta")

    assert fake_client.get_share(created.id) is not None
    print("[test] OK: lanzo ShareUnauthorizedError y el share sigue disponible para reintentar.")


def test_reveal_share_dos_veces_lanza_unavailable_la_segunda_vez(fake_client):
    print("\n[test] reveal_share dos veces seguidas...")
    created = _create_text(fake_client)

    _reveal(fake_client, created.id)

    with pytest.raises(ShareUnavailableError):
        _reveal(fake_client, created.id)
    print("[test] OK: lanzo ShareUnavailableError la segunda vez.")


def test_reveal_share_autodestruye_tras_superar_el_maximo_de_intentos_fallidos(fake_client):
    print("\n[test] reveal_share con contraseña incorrecta repetida hasta superar el maximo...")
    created = _create_text(fake_client, text="secreto", password="correcta123")

    for intento in range(3):
        with pytest.raises(ShareUnauthorizedError):
            _reveal(fake_client, created.id, "incorrecta", max_attempts=3)
        print(f"[test]   intento {intento + 1}/3 rechazado.")

    # El 3er intento fallido alcanzo el maximo (3) y autodestruyo el share -
    # ni siquiera la contraseña correcta funciona despues.
    with pytest.raises(ShareUnavailableError):
        _reveal(fake_client, created.id, "correcta123", max_attempts=3)
    print("[test] OK: el share se autodestruyo, ni la contraseña correcta funciona despues.")
