import pytest

from app.services.sharedContent.errors import ShareUnavailableError
from app.services.sharedContent.security.one_time_access import consume_view


def _row(share_id="abc"):
    return {"id": share_id, "content_type": "text", "content_text": "hola", "viewed_at": None}


def test_consume_view_devuelve_la_fila_la_primera_vez(fake_client):
    print("\n[test] consume_view sobre un share nunca visto...")
    fake_client.insert_share(_row())

    row = consume_view("abc", fake_client)

    assert row["viewed_at"] is not None
    assert row["content_text"] == "hola"
    print("[test] OK: la fila vuelve con viewed_at seteado y el contenido original.")


def test_consume_view_rechaza_un_segundo_intento_incluso_casi_simultaneo(fake_client):
    print("\n[test] consume_view dos veces seguidas sobre el mismo id (simula acceso casi simultaneo)...")
    fake_client.insert_share(_row())

    consume_view("abc", fake_client)

    with pytest.raises(ShareUnavailableError):
        consume_view("abc", fake_client)
    print("[test] OK: el segundo intento lanzo ShareUnavailableError.")


def test_consume_view_sobre_id_inexistente_lanza_error(fake_client):
    print("\n[test] consume_view sobre un id que no existe...")
    with pytest.raises(ShareUnavailableError):
        consume_view("no-existe", fake_client)
    print("[test] OK: lanzo ShareUnavailableError.")
