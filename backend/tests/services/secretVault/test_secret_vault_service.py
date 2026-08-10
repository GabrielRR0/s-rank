import base64

import pytest

from app.services.secretVault import secret_vault_service
from app.services.secretVault.errors import VaultUnavailableError


def _create(client, max_copies=3, ttl_seconds=60, ciphertext="cifrado", nonce="nonce"):
    return secret_vault_service.create_vault_item(
        ciphertext=ciphertext,
        nonce=nonce,
        max_copies=max_copies,
        ttl_seconds=ttl_seconds,
        room_id="sala-1",
        client=client,
    )


def test_create_vault_item_guarda_el_ciphertext_tal_cual(fake_vault_client):
    print("\n[test] create_vault_item guarda el ciphertext sin tocarlo...")
    result = _create(fake_vault_client, ciphertext="abc123")

    stored = fake_vault_client.get_vault_item(result.id)
    assert stored["ciphertext"] == "abc123"
    assert stored["remaining_copies"] == stored["max_copies"]
    print("[test] OK: el backend nunca cifra/descifra, solo administra el contador.")


def test_get_vault_item_de_texto_devuelve_content_type_text(fake_vault_client):
    # Regresion puntual (ver test_secret_vault_router.py para el mismo
    # chequeo a nivel HTTP): create_vault_item no manda "content_type" en
    # el record que inserta (confia en el default 'text' de la columna) -
    # get_vault_item tiene que devolver igual content_type='text' aunque la
    # fila cruda no tenga esa clave, via el default del propio
    # VaultItemResponse. Un valor faltante/incorrecto aca es lo que hizo
    # que un secreto de texto se mostrara como reproductor de audio.
    print("\n[test] get_vault_item de un item de texto devuelve content_type='text'...")
    created = _create(fake_vault_client, ciphertext="un-secreto-de-texto")

    item = secret_vault_service.get_vault_item(created.id, fake_vault_client)

    assert item.content_type == "text"
    assert item.mime_type is None
    print("[test] OK: content_type='text', mime_type=None.")


def test_create_vault_item_con_max_copies_fuera_de_rango_lanza_value_error(fake_vault_client):
    print("\n[test] create_vault_item con max_copies invalido...")
    with pytest.raises(ValueError):
        _create(fake_vault_client, max_copies=7)
    print("[test] OK: lanzo ValueError.")


def test_create_vault_item_con_ttl_no_permitido_lanza_value_error(fake_vault_client):
    print("\n[test] create_vault_item con ttl_seconds invalido...")
    with pytest.raises(ValueError):
        _create(fake_vault_client, ttl_seconds=999)
    print("[test] OK: lanzo ValueError.")


def test_get_vault_item_de_id_inexistente_lanza_unavailable(fake_vault_client):
    print("\n[test] get_vault_item con id inexistente...")
    with pytest.raises(VaultUnavailableError):
        secret_vault_service.get_vault_item("no-existe", fake_vault_client)
    print("[test] OK: lanzo VaultUnavailableError.")


def test_consume_copy_decrementa_el_contador(fake_vault_client):
    print("\n[test] consume_copy decrementa remaining_copies...")
    created = _create(fake_vault_client, max_copies=3)

    result = secret_vault_service.consume_copy(created.id, fake_vault_client)

    assert result.remaining_copies == 2
    assert fake_vault_client.get_vault_item(created.id) is not None
    print("[test] OK: quedan 2 copias, el item sigue disponible.")


def test_consume_copy_hasta_agotar_autodestruye_el_item(fake_vault_client):
    print("\n[test] consume_copy repetido hasta agotar max_copies...")
    created = _create(fake_vault_client, max_copies=2)

    primero = secret_vault_service.consume_copy(created.id, fake_vault_client)
    segundo = secret_vault_service.consume_copy(created.id, fake_vault_client)

    assert primero.remaining_copies == 1
    assert segundo.remaining_copies == 0
    assert fake_vault_client.get_vault_item(created.id) is None
    print("[test] OK: al llegar a 0 copias la fila se borro (autodestruccion inmediata).")

    with pytest.raises(VaultUnavailableError):
        secret_vault_service.consume_copy(created.id, fake_vault_client)
    print("[test] OK: un intento de copia despues de agotado lanza VaultUnavailableError.")


def test_get_vault_item_de_item_agotado_lanza_unavailable(fake_vault_client):
    print("\n[test] get_vault_item de un item con max_copies=1 ya copiado...")
    created = _create(fake_vault_client, max_copies=1)
    secret_vault_service.consume_copy(created.id, fake_vault_client)

    with pytest.raises(VaultUnavailableError):
        secret_vault_service.get_vault_item(created.id, fake_vault_client)
    print("[test] OK: lanzo VaultUnavailableError, el GET tampoco lo devuelve.")


def _create_media(client, content_type="image", mime_type="image/png", max_copies=3, ttl_seconds=60, ciphertext=b"bytes-cifrados", nonce="nonce"):
    return secret_vault_service.create_vault_media_item(
        content_type=content_type,
        mime_type=mime_type,
        max_copies=max_copies,
        ttl_seconds=ttl_seconds,
        nonce=nonce,
        ciphertext_bytes=ciphertext,
        max_bytes=10_000_000,
        room_id="sala-1",
        client=client,
    )


def test_create_vault_media_item_sube_a_storage_y_deja_ciphertext_null_en_la_fila(fake_vault_client):
    print("\n[test] create_vault_media_item sube el contenido a Storage...")
    result = _create_media(fake_vault_client, ciphertext=b"imagen-cifrada")

    stored = fake_vault_client.get_vault_item(result.id)
    assert stored["ciphertext"] is None
    assert stored["content_type"] == "image"
    assert fake_vault_client.files[stored["storage_path"]] == b"imagen-cifrada"
    print("[test] OK: la fila no guarda el contenido inline, vive en Storage.")


def test_get_vault_item_de_media_devuelve_el_contenido_codificado_en_base64url(fake_vault_client):
    print("\n[test] get_vault_item de un item de imagen...")
    created = _create_media(fake_vault_client, ciphertext=b"\x00\x01\x02binario")

    item = secret_vault_service.get_vault_item(created.id, fake_vault_client)

    assert base64.urlsafe_b64decode(item.ciphertext + "==") == b"\x00\x01\x02binario"
    assert item.content_type == "image"
    assert item.mime_type == "image/png"
    print("[test] OK: el binario original se recupera decodificando la respuesta.")


def test_create_vault_media_item_con_content_type_invalido_lanza_value_error(fake_vault_client):
    print("\n[test] create_vault_media_item con content_type invalido...")
    with pytest.raises(ValueError):
        _create_media(fake_vault_client, content_type="video")
    print("[test] OK: lanzo ValueError.")


def test_create_vault_media_item_con_mime_type_que_no_corresponde_lanza_value_error(fake_vault_client):
    print("\n[test] create_vault_media_item con mime_type de audio pero content_type imagen...")
    with pytest.raises(ValueError):
        _create_media(fake_vault_client, content_type="image", mime_type="audio/webm")
    print("[test] OK: lanzo ValueError.")


def test_create_vault_media_item_demasiado_grande_lanza_value_error(fake_vault_client):
    print("\n[test] create_vault_media_item con archivo mas grande que max_bytes...")
    with pytest.raises(ValueError):
        secret_vault_service.create_vault_media_item(
            content_type="image",
            mime_type="image/png",
            max_copies=3,
            ttl_seconds=60,
            nonce="nonce",
            ciphertext_bytes=b"x" * 100,
            max_bytes=50,
            room_id="sala-1",
            client=fake_vault_client,
        )
    print("[test] OK: lanzo ValueError.")


def test_purge_de_item_de_media_borra_el_archivo_de_storage(fake_vault_client):
    print("\n[test] agotar copias de un item de audio borra el archivo de Storage...")
    created = _create_media(fake_vault_client, content_type="audio", mime_type="audio/webm", max_copies=1)
    storage_path = fake_vault_client.get_vault_item(created.id)["storage_path"]
    assert storage_path in fake_vault_client.files

    secret_vault_service.consume_copy(created.id, fake_vault_client)

    assert storage_path not in fake_vault_client.files
    print("[test] OK: el archivo se borro junto con la fila.")
