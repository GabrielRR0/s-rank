from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_crear_share_respeta_rate_limit_y_devuelve_429():
    print(f"\n[test] POST /api/shared-content mas alla de RATE_LIMIT_CREATE ({settings.rate_limit_create})...")
    limit = int(settings.rate_limit_create.split("/")[0])

    for i in range(limit):
        response = client.post(
            "/api/shared-content", data={"content_type": "text", "text": "hola", "expires_in_minutes": "60"}
        )
        assert response.status_code == 201, f"request {i + 1} deberia pasar bajo el limite"

    response = client.post(
        "/api/shared-content", data={"content_type": "text", "text": "hola", "expires_in_minutes": "60"}
    )
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_reveal_respeta_rate_limit_mas_estricto():
    print(f"\n[test] POST reveal mas alla de RATE_LIMIT_REVEAL ({settings.rate_limit_reveal})...")
    share_id = client.post(
        "/api/shared-content",
        data={"content_type": "text", "text": "hola", "expires_in_minutes": "60", "password": "correcta123"},
    ).json()["id"]
    limit = int(settings.rate_limit_reveal.split("/")[0])

    # Contraseña incorrecta a proposito en cada intento: asi ninguno "gasta"
    # la vista unica, y el intento (limit + 1) llega efectivamente al rate
    # limit en vez de toparse antes con un 410 por vista ya consumida.
    for i in range(limit):
        response = client.post(f"/api/shared-content/{share_id}/reveal", json={"password": "incorrecta"})
        assert response.status_code == 401, f"request {i + 1} deberia pasar bajo el limite"

    response = client.post(f"/api/shared-content/{share_id}/reveal", json={"password": "incorrecta"})
    assert response.status_code == 429
    print(f"[test] OK: request {limit + 1} devolvio 429 como se esperaba.")


def test_post_con_body_gigante_responde_413():
    print("\n[test] POST /api/shared-content con body > MAX_BODY_BYTES...")
    response = client.post(
        "/api/shared-content",
        data={"content_type": "text", "text": "a" * (settings.max_body_bytes + 5000), "expires_in_minutes": "60"},
    )

    assert response.status_code == 413
    print("[test] OK: status 413 como se esperaba.")


def test_get_status_incluye_headers_de_seguridad():
    print("\n[test] GET /api/shared-content/{id} trae headers de seguridad...")
    response = client.get("/api/shared-content/no-existe")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    print("[test] OK: headers de seguridad presentes.")
