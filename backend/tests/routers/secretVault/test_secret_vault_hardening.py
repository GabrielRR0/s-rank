from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def _create_vault_item(max_copies=3, ttl_seconds=60, ciphertext="cifrado-b64", nonce="nonce-b64"):
    body = {"ciphertext": ciphertext, "nonce": nonce, "max_copies": max_copies, "ttl_seconds": ttl_seconds}
    return client.post("/api/secret-vault", json=body)


def test_crear_item_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] POST /api/secret-vault mas alla de RATE_LIMIT_VAULT_CREATE ({settings.rate_limit_vault_create})...")
    limit = int(settings.rate_limit_vault_create.split("/")[0])

    for i in range(limit):
        response = _create_vault_item()
        assert response.status_code == 201, f"request {i + 1} deberia pasar bajo el limite"

    response = _create_vault_item()
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_get_status_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] GET /api/secret-vault/{{id}} mas alla de RATE_LIMIT_VAULT_STATUS ({settings.rate_limit_vault_status})...")
    limit = int(settings.rate_limit_vault_status.split("/")[0])

    for i in range(limit):
        response = client.get("/api/secret-vault/no-existe")
        assert response.status_code == 410, f"request {i + 1} deberia pasar bajo el limite"

    response = client.get("/api/secret-vault/no-existe")
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_copiar_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] POST /api/secret-vault/{{id}}/copy mas alla de RATE_LIMIT_VAULT_COPY ({settings.rate_limit_vault_copy})...")
    limit = int(settings.rate_limit_vault_copy.split("/")[0])

    # slowapi cuenta por (IP, URL exacta) - ver test_rate_limit_de_copy_es_por_item_no_global
    # mas abajo. Para ejercitar ESTE limite hay que pegarle muchas veces al
    # MISMO item_id (no crear uno nuevo por request): las primeras
    # max_copies devuelven 200, el resto 410 (copias agotadas) - da igual,
    # el limite cuenta el request en si, no si tuvo copias para dar.
    item_id = _create_vault_item(max_copies=6).json()["id"]

    for i in range(limit):
        response = client.post(f"/api/secret-vault/{item_id}/copy")
        assert response.status_code in (200, 410), f"request {i + 1} deberia pasar bajo el limite"

    response = client.post(f"/api/secret-vault/{item_id}/copy")
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_rate_limit_de_copy_es_por_item_no_global(monkeypatch):
    # Hallazgo de seguridad, no un bug de test: slowapi usa key_style="url"
    # por defecto (ver Limiter en app/core/rate_limit.py, sin override) - el
    # limite de copy se cuenta por (IP, URL exacta), y la URL incluye el
    # item_id. Esto significa que RATE_LIMIT_VAULT_COPY protege UN item
    # puntual contra fuerza bruta, pero NO limita cuantos items DISTINTOS
    # puede tantear la misma IP en el mismo minuto - cada item nuevo arranca
    # con su propio cupo de copy intacto. Mismo comportamiento heredado ya
    # existe en /api/shared-content/{id}/reveal (mismo Limiter, mismo
    # key_style). Este test documenta el comportamiento real, no lo corrige.
    # Limite bajado a proposito (en vez de crear >RATE_LIMIT_VAULT_COPY
    # items reales) para no chocar con RATE_LIMIT_VAULT_CREATE, que es mas
    # estricto - el numero en si no importa, lo que importa es "mas
    # requests que el limite, todos a items distintos, ninguno bloqueado".
    monkeypatch.setattr(settings, "rate_limit_vault_copy", "5/minute")
    print("\n[test] copiar 10 items DISTINTOS (1 vez cada uno) desde la misma IP, con RATE_LIMIT_VAULT_COPY=5/minute...")

    for i in range(10):
        item_id = _create_vault_item(max_copies=1).json()["id"]
        response = client.post(f"/api/secret-vault/{item_id}/copy")
        assert response.status_code == 200, (
            f"item #{i + 1}: el limite deberia ser por item, no global - "
            "si esto falla, el comportamiento de slowapi cambio y el "
            "comentario de arriba (y el hallazgo reportado) quedaron desactualizados"
        )
    print("[test] Confirmado: 10 items distintos (el doble del limite de 5/minute), 1 copia cada uno, ninguno bloqueado - el limite es por-item, no por-IP-global.")


def test_post_con_body_gigante_responde_413():
    print("\n[test] POST /api/secret-vault con ciphertext > MAX_BODY_BYTES...")
    response = _create_vault_item(ciphertext="a" * (settings.max_body_bytes + 5000))

    assert response.status_code == 413
    print("[test] OK: status 413 como se esperaba.")


def test_respuesta_incluye_headers_de_seguridad():
    print("\n[test] GET /api/secret-vault/{id} trae headers de seguridad...")
    response = client.get("/api/secret-vault/no-existe")

    assert response.status_code == 410
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "max-age" in response.headers["strict-transport-security"]
    print("[test] OK: headers de seguridad presentes, incluyendo Strict-Transport-Security.")


def test_origin_no_permitido_responde_403():
    print("\n[test] GET /api/secret-vault/{id} con header Origin de un sitio no permitido...")
    response = client.get("/api/secret-vault/no-existe", headers={"Origin": "https://sitio-malicioso.com"})

    assert response.status_code == 403
    print("[test] OK: status 403 como se esperaba.")


def test_origin_permitido_no_es_bloqueado():
    print("\n[test] GET /api/secret-vault/{id} con Origin del frontend de desarrollo...")
    response = client.get("/api/secret-vault/no-existe", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 410
    print("[test] OK: status 410 (no 403), el origen permitido no fue bloqueado.")
