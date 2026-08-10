import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)

# Concurrencia real con threads de SO (no asyncio simulado) contra el mismo
# TestClient - la forma en que de verdad se probaria "puedo robar mas copias
# de las que hay" o "puedo ganarle una carrera a otro creando la misma
# sala". Ver tests/conftest.py: los fakes de storage llevan un
# threading.Lock puntualmente para esto, replicando la atomicidad que
# Postgres da gratis via UPDATE...WHERE / unique constraint.


def test_copiar_en_paralelo_nunca_entrega_mas_copias_de_las_que_hay():
    print("\n[test] 20 threads pegandole a POST /copy en paralelo sobre un item con max_copies=1...")
    item_id = client.post(
        "/api/secret-vault", json={"ciphertext": "secreto", "nonce": "n", "max_copies": 1, "ttl_seconds": 60}
    ).json()["id"]

    with ThreadPoolExecutor(max_workers=20) as pool:
        respuestas = list(pool.map(lambda _: client.post(f"/api/secret-vault/{item_id}/copy"), range(20)))

    exitosas = [r for r in respuestas if r.status_code == 200]
    agotadas = [r for r in respuestas if r.status_code == 410]

    assert len(exitosas) == 1, f"deberia haber ganado exactamente 1 request, ganaron {len(exitosas)}"
    assert len(agotadas) == 19
    assert exitosas[0].json()["remaining_copies"] == 0
    print(f"[test] OK: de 20 requests simultaneas, exactamente 1 gano la copia (las otras 19 -> 410). remaining_copies nunca fue negativo.")


def test_crear_la_misma_sala_en_paralelo_solo_uno_gana():
    # El limit string de @limiter.limit(settings.rate_limit_realtime_rooms)
    # queda fijado en el decorador cuando se importa app.main (una sola vez
    # por sesion de pytest) - monkeypatchear settings despues no lo cambia,
    # a diferencia de un chequeo leido en runtime. Por eso este test se
    # queda deliberadamente por DEBAJO de RATE_LIMIT_REALTIME_ROOMS
    # (10/minute por defecto) en vez de intentar destrabarlo.
    intentos = int(settings.rate_limit_realtime_rooms.split("/")[0]) - 2
    print(f"\n[test] {intentos} threads intentando crear la MISMA sala (mismo room_id) en paralelo...")
    room_id = str(uuid.uuid4())

    with ThreadPoolExecutor(max_workers=intentos) as pool:
        respuestas = list(
            pool.map(
                lambda _: client.post(
                    "/api/secret-chat/rooms", json={"room_id": room_id, "password": "correcta123"}
                ),
                range(intentos),
            )
        )

    creadas = [r for r in respuestas if r.status_code == 201]
    rechazadas = [r for r in respuestas if r.status_code == 409]

    assert len(creadas) == 1, f"deberia haber ganado exactamente 1 request, ganaron {len(creadas)}"
    assert len(rechazadas) == intentos - 1
    print(f"[test] OK: de {intentos} intentos simultaneos de crear la misma sala, exactamente 1 gano (las otras {intentos - 1} -> 409).")
