# routers/secretChatAuth

Capa HTTP de la autorización de Realtime del chat secreto. Ver `backend/README.md` sección 13 para el panorama completo.

## Endpoints

- **`POST /api/secret-chat/rooms`**: crea una sala **con** contraseña — registra la fila en `secret_chat_rooms` y devuelve el primer par de tokens en la misma respuesta (evita un segundo Turnstile seguido). `RoomAlreadyExistsError` → `409`.
- **`POST /api/secret-chat/realtime-token`**: usado por quien se une a cualquier sala, y por quien crea una sala **sin** contraseña. `RoomPasswordInvalidError` → `401` (retryable, y cuenta como fallo para `bot_guard`); `RoomExpiredError` → `410` (la sala tuvo contraseña y venció, no revive).
- **`POST /api/secret-chat/realtime-token/refresh`**: renueva el `access_token` a partir de un `session_token` válido — sin Turnstile, sin `bot_guard` (un session token vencido no es una señal de bot, es el paso esperado del ciclo de vida). `SessionTokenInvalidError` → `401`.

## Por qué `_require_turnstile_or_block` chequea `bot_guard` antes de llamar a Cloudflare

`bot_guard.is_blocked(ip)` es una consulta en memoria, gratis; verificar Turnstile es un round-trip real a la API de Cloudflare. Chequear el bloqueo primero evita gastar esa llamada en una IP que ya sabemos que está bloqueada.
