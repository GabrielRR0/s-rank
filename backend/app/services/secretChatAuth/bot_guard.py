from datetime import datetime, timedelta, timezone

from app.config import settings

# En memoria, por instancia del proceso - mismo nivel de simplicidad que
# RATE_LIMIT_STORAGE_URI=memory:// (el default de slowapi en este proyecto).
# En un despliegue serverless con multiples instancias el bloqueo no es
# estrictamente global (cada instancia lleva su propia cuenta) - mismo
# escape hatch ya documentado para el rate limiter: apuntar a Redis
# (Upstash) si algun dia hace falta un bloqueo realmente global. Ver
# backend/README.md seccion 13.
_fallos_por_ip: dict[str, list[datetime]] = {}
_bloqueadas_hasta: dict[str, datetime] = {}


def register_failure(ip: str) -> None:
    """Registra un fallo de Turnstile o de contraseña de sala para esta IP -
    las dos señales de un intento indebido de entrar a una sala. No
    registra ningun otro tipo de error (ej. rate limit, validacion) para no
    bloquear por accidente a alguien con un bug de cliente legitimo."""
    ahora = datetime.now(timezone.utc)
    ventana_inicio = ahora - timedelta(seconds=settings.bot_guard_window_seconds)

    fallos_previos = _fallos_por_ip.get(ip, [])
    fallos_vigentes = [f for f in fallos_previos if f >= ventana_inicio]
    fallos_vigentes.append(ahora)
    _fallos_por_ip[ip] = fallos_vigentes

    if len(fallos_vigentes) >= settings.bot_guard_max_failures:
        _bloqueadas_hasta[ip] = ahora + timedelta(seconds=settings.bot_guard_block_seconds)


def is_blocked(ip: str) -> bool:
    bloqueada_hasta = _bloqueadas_hasta.get(ip)
    if bloqueada_hasta is None:
        return False
    if datetime.now(timezone.utc) >= bloqueada_hasta:
        _bloqueadas_hasta.pop(ip, None)
        _fallos_por_ip.pop(ip, None)
        return False
    return True


def reset() -> None:
    """Solo para tests - limpia todo el estado en memoria (mismo criterio
    que limiter.reset() en tests/conftest.py)."""
    _fallos_por_ip.clear()
    _bloqueadas_hasta.clear()
