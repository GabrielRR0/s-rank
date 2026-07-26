from datetime import datetime, timedelta, timezone

import pytest

from app.services.sharedContent.cleanup.expire_on_access import is_expired, purge_share, raise_if_expired
from app.services.sharedContent.errors import ShareUnavailableError


def _row(expires_at, storage_path=None):
    return {
        "id": "abc",
        "content_type": "file" if storage_path else "text",
        "storage_path": storage_path,
        "expires_at": expires_at.isoformat(),
    }


def test_is_expired_con_fecha_pasada():
    print("\n[test] is_expired con expires_at en el pasado...")
    row = _row(datetime.now(timezone.utc) - timedelta(minutes=1))

    assert is_expired(row) is True
    print("[test] OK: is_expired devolvio True.")


def test_is_expired_con_fecha_futura():
    print("\n[test] is_expired con expires_at en el futuro...")
    row = _row(datetime.now(timezone.utc) + timedelta(hours=1))

    assert is_expired(row) is False
    print("[test] OK: is_expired devolvio False.")


def test_purge_share_borra_fila_y_archivo(fake_client):
    print("\n[test] purge_share borra la fila y el archivo asociado...")
    row = _row(datetime.now(timezone.utc) + timedelta(hours=1), storage_path="abc/foto.png")
    fake_client.insert_share(row)
    fake_client.upload_file("abc/foto.png", b"contenido", "image/png")

    purge_share(row, fake_client)

    assert fake_client.get_share("abc") is None
    assert "abc/foto.png" not in fake_client.files
    print("[test] OK: fila y archivo eliminados.")


def test_raise_if_expired_purga_y_lanza_error_si_ya_expiro(fake_client):
    print("\n[test] raise_if_expired con un share vencido...")
    row = _row(datetime.now(timezone.utc) - timedelta(minutes=1))
    fake_client.insert_share(row)

    with pytest.raises(ShareUnavailableError):
        raise_if_expired(row, fake_client)

    assert fake_client.get_share("abc") is None
    print("[test] OK: lanzo ShareUnavailableError y purgo la fila.")


def test_raise_if_expired_no_hace_nada_si_todavia_es_valido(fake_client):
    print("\n[test] raise_if_expired con un share todavia valido...")
    row = _row(datetime.now(timezone.utc) + timedelta(hours=1))
    fake_client.insert_share(row)

    raise_if_expired(row, fake_client)

    assert fake_client.get_share("abc") is not None
    print("[test] OK: no lanzo error y la fila sigue existiendo.")
