from starlette.requests import Request

from app.core.rate_limit import get_client_ip


def _build_request(headers: list[tuple[bytes, bytes]], client_host: str = "127.0.0.1") -> Request:
    scope = {"type": "http", "headers": headers, "client": (client_host, 12345)}
    return Request(scope)


def test_get_client_ip_usa_x_forwarded_for_si_esta_presente():
    print("\n[test] get_client_ip con X-Forwarded-For presente...")
    request = _build_request([(b"x-forwarded-for", b"203.0.113.5")])

    assert get_client_ip(request) == "203.0.113.5"
    print("[test] OK: uso la IP del header, no la de la conexion TCP.")


def test_get_client_ip_usa_la_primera_ip_de_una_cadena_de_proxies():
    print("\n[test] get_client_ip con varias IPs en X-Forwarded-For (cadena de proxies)...")
    request = _build_request([(b"x-forwarded-for", b"203.0.113.5, 70.41.3.18, 150.172.238.178")])

    assert get_client_ip(request) == "203.0.113.5"
    print("[test] OK: uso la primera (la mas cercana al cliente real).")


def test_get_client_ip_recorta_espacios_alrededor_de_la_ip():
    print("\n[test] get_client_ip con espacios extra en el header...")
    request = _build_request([(b"x-forwarded-for", b"  203.0.113.5  , 70.41.3.18")])

    assert get_client_ip(request) == "203.0.113.5"
    print("[test] OK: sin espacios sobrantes.")


def test_get_client_ip_cae_a_la_ip_de_conexion_sin_el_header():
    print("\n[test] get_client_ip sin X-Forwarded-For (ej. request directo, sin proxy)...")
    request = _build_request([], client_host="192.168.1.50")

    assert get_client_ip(request) == "192.168.1.50"
    print("[test] OK: uso la IP de la conexion TCP como fallback.")
