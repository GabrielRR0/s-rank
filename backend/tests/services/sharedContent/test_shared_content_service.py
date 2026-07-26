import pytest

from app.schemas.sharedContent.shared_content_schemas import RevealedText
from app.services.sharedContent import shared_content_service
from app.services.sharedContent.errors import ShareUnauthorizedError, ShareUnavailableError

MAX_FILE_BYTES = 10_000_000


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


def test_create_share_de_texto_guarda_el_contenido(fake_client):
    print("\n[test] create_share con content_type='text'...")
    result = _create_text(fake_client, text="hola")

    assert result.id
    assert fake_client.get_share(result.id)["content_text"] == "hola"
    print("[test] OK: el texto quedo guardado en el storage.")


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


def test_get_share_status_de_share_inexistente(fake_client):
    print("\n[test] get_share_status con id inexistente...")
    status = shared_content_service.get_share_status("no-existe", fake_client)

    assert status.exists is False
    print("[test] OK: exists=False.")


def test_reveal_share_devuelve_texto_y_lo_borra_despues(fake_client):
    print("\n[test] reveal_share con texto...")
    created = _create_text(fake_client, text="secreto")

    result = shared_content_service.reveal_share(created.id, None, fake_client)

    assert isinstance(result, RevealedText)
    assert result.text == "secreto"
    assert fake_client.get_share(created.id) is None
    print("[test] OK: contenido devuelto y fila purgada.")


def test_reveal_share_con_password_incorrecta_lanza_unauthorized_sin_purgar(fake_client):
    print("\n[test] reveal_share con password incorrecta...")
    created = _create_text(fake_client, text="secreto", password="correcta123")

    with pytest.raises(ShareUnauthorizedError):
        shared_content_service.reveal_share(created.id, "incorrecta", fake_client)

    assert fake_client.get_share(created.id) is not None
    print("[test] OK: lanzo ShareUnauthorizedError y el share sigue disponible para reintentar.")


def test_reveal_share_dos_veces_lanza_unavailable_la_segunda_vez(fake_client):
    print("\n[test] reveal_share dos veces seguidas...")
    created = _create_text(fake_client)

    shared_content_service.reveal_share(created.id, None, fake_client)

    with pytest.raises(ShareUnavailableError):
        shared_content_service.reveal_share(created.id, None, fake_client)
    print("[test] OK: lanzo ShareUnavailableError la segunda vez.")
