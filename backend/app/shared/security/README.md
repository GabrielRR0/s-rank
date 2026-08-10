# shared/security

Utilidades de seguridad genéricas, sin lógica de negocio ni datos de dominio propios — reutilizables por cualquier dominio del backend. Viven acá (no en `services/sharedContent/security/`, donde estaban originalmente) porque no tienen nada específico de ese dominio, mismo criterio que ya documenta `shared/storage/README.md`.

## Archivos

- **`turnstile.py`**: `verify_turnstile_token(token)` — verificación anti-bot opcional (Cloudflare Turnstile), apagada por defecto vía `TURNSTILE_ENABLED`. Usada por `sharedContent` (creación de shares) y `secretChatAuth` (creación/unión a salas de chat).
- **`password_hash.py`**: `hash_password`/`verify_password` sobre `bcrypt`. Usada por `sharedContent` (contraseña de un share) y `secretChatAuth` (contraseña de una sala).

## Por qué se movieron acá y `encryption.py` no

`services/sharedContent/security/encryption.py` cifra con `MASTER_ENCRYPTION_KEY`, una clave que vive en el backend — ese modelo es correcto para `sharedContent` pero incompatible con el chat secreto, que necesita E2EE real (la clave nunca toca el backend). Por eso `encryption.py` se quedó donde estaba, y el Cofre del chat (`secretVault`) nunca lo importa. `turnstile.py`/`password_hash.py`, en cambio, no cifran ni manejan ningún dato de negocio — son wrappers genéricos sobre una API externa y sobre `bcrypt` respectivamente, así que compartirlos entre dominios no genera ningún acoplamiento real.
