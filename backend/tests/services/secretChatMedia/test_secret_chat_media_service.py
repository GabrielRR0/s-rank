import base64
from datetime import datetime, timedelta, timezone

import pytest

from app.services.secretChatMedia import secret_chat_media_service
from app.services.secretChatMedia.errors import ChatMediaUnavailableError


def _create(client, room_id="sala-1", nonce="nonce", mime_type="image/png", ttl_seconds=60, ciphertext=b"bytes-cifrados", max_bytes=10_000_000):
    return secret_chat_media_service.create_media_item(
        room_id=room_id,
        nonce=nonce,
        mime_type=mime_type,
        ttl_seconds=ttl_seconds,
        ciphertext_bytes=ciphertext,
        max_bytes=max_bytes,
        client=client,
    )


def test_create_media_item_sube_a_storage_y_guarda_la_fila(fake_chat_media_client):
    print("\n[test] create_media_item sube el contenido a Storage...")
    result = _create(fake_chat_media_client, ciphertext=b"imagen-cifrada")

    stored = fake_chat_media_client.get_media_item(result.id)
    assert stored["mime_type"] == "image/png"
    assert fake_chat_media_client.files[stored["storage_path"]] == b"imagen-cifrada"
    print("[test] OK: el backend guarda solo bytes opacos, nunca el contenido real.")


def test_get_media_item_devuelve_el_contenido_codificado_en_base64url(fake_chat_media_client):
    print("\n[test] get_media_item devuelve el contenido decodificable...")
    created = _create(fake_chat_media_client, ciphertext=b"\x00\x01audio-binario")

    item = secret_chat_media_service.get_media_item(created.id, fake_chat_media_client)

    assert base64.urlsafe_b64decode(item.ciphertext + "==") == b"\x00\x01audio-binario"
    assert item.mime_type == "image/png"
    print("[test] OK: el binario original se recupera decodificando la respuesta.")


def test_get_media_item_de_id_inexistente_lanza_unavailable(fake_chat_media_client):
    print("\n[test] get_media_item con id inexistente...")
    with pytest.raises(ChatMediaUnavailableError):
        secret_chat_media_service.get_media_item("no-existe", fake_chat_media_client)
    print("[test] OK: lanzo ChatMediaUnavailableError.")


def test_create_media_item_con_ttl_no_permitido_lanza_value_error(fake_chat_media_client):
    print("\n[test] create_media_item con ttl_seconds invalido...")
    with pytest.raises(ValueError):
        _create(fake_chat_media_client, ttl_seconds=999)
    print("[test] OK: lanzo ValueError.")


def test_create_media_item_con_mime_type_no_permitido_lanza_value_error(fake_chat_media_client):
    print("\n[test] create_media_item con mime_type que no es imagen/audio...")
    with pytest.raises(ValueError):
        _create(fake_chat_media_client, mime_type="application/pdf")
    print("[test] OK: lanzo ValueError.")


def test_create_media_item_demasiado_grande_lanza_value_error(fake_chat_media_client):
    print("\n[test] create_media_item con archivo mas grande que max_bytes...")
    with pytest.raises(ValueError):
        _create(fake_chat_media_client, ciphertext=b"x" * 100, max_bytes=50)
    print("[test] OK: lanzo ValueError.")


def test_get_media_item_vencido_lanza_unavailable_y_purga(fake_chat_media_client, monkeypatch):
    print("\n[test] get_media_item de un item ya vencido...")
    created = _create(fake_chat_media_client, ttl_seconds=5)
    row = fake_chat_media_client.get_media_item(created.id)
    row["expires_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    fake_chat_media_client.rows[created.id] = row

    with pytest.raises(ChatMediaUnavailableError):
        secret_chat_media_service.get_media_item(created.id, fake_chat_media_client)

    assert fake_chat_media_client.get_media_item(created.id) is None
    print("[test] OK: lanzo ChatMediaUnavailableError y purgo la fila + el archivo.")
