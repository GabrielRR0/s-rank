from datetime import datetime, timedelta, timezone

from app.config import settings
from app.services.secretChatAuth import bot_guard


def test_ip_no_bloqueada_por_defecto():
    print("\n[test] is_blocked sobre una IP sin fallos previos...")
    assert bot_guard.is_blocked("1.2.3.4") is False
    print("[test] OK: no esta bloqueada.")


def test_bloquea_al_alcanzar_el_maximo_de_fallos(monkeypatch):
    print("\n[test] register_failure repetido hasta alcanzar BOT_GUARD_MAX_FAILURES...")
    monkeypatch.setattr(settings, "bot_guard_max_failures", 3)
    ip = "9.9.9.9"

    for intento in range(2):
        bot_guard.register_failure(ip)
        assert bot_guard.is_blocked(ip) is False
        print(f"[test]   fallo {intento + 1}/3, todavia no bloqueada.")

    bot_guard.register_failure(ip)
    assert bot_guard.is_blocked(ip) is True
    print("[test] OK: bloqueada al 3er fallo.")


def test_fallos_fuera_de_la_ventana_no_cuentan(monkeypatch):
    print("\n[test] fallos viejos (fuera de BOT_GUARD_WINDOW_SECONDS) no cuentan...")
    monkeypatch.setattr(settings, "bot_guard_max_failures", 2)
    monkeypatch.setattr(settings, "bot_guard_window_seconds", 60)
    ip = "5.5.5.5"

    bot_guard.register_failure(ip)
    # Simula que el primer fallo quedo viejo, fuera de la ventana.
    bot_guard._fallos_por_ip[ip] = [datetime.now(timezone.utc) - timedelta(seconds=120)]

    bot_guard.register_failure(ip)

    assert bot_guard.is_blocked(ip) is False
    print("[test] OK: solo un fallo vigente, no alcanza el maximo de 2.")


def test_desbloquea_pasada_la_ventana_de_bloqueo(monkeypatch):
    print("\n[test] is_blocked despues de que pasa BOT_GUARD_BLOCK_SECONDS...")
    monkeypatch.setattr(settings, "bot_guard_max_failures", 1)
    ip = "7.7.7.7"

    bot_guard.register_failure(ip)
    assert bot_guard.is_blocked(ip) is True

    # Simula que ya paso la ventana de bloqueo, sin esperar de verdad.
    bot_guard._bloqueadas_hasta[ip] = datetime.now(timezone.utc) - timedelta(seconds=1)

    assert bot_guard.is_blocked(ip) is False
    print("[test] OK: se desbloqueo pasada la ventana.")
