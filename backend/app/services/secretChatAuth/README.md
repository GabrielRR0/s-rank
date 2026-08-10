# services/secretChatAuth

Autorización de Supabase Realtime para el chat secreto, más la contraseña opcional de sala. Ver `backend/README.md` sección 13 para el panorama completo (por qué existe, SQL de `realtime.messages`/`secret_chat_rooms`, límites documentados).

## Archivos

- **`secret_chat_auth_service.py`**: mintea dos JWT por sala — un **access token** corto (`role: authenticated`, lo único que las políticas RLS de Supabase realmente exigen) y un **session token** más largo (`token_type: chat_session`, sin `role`, así nunca sirve como credencial de Realtime aunque se filtre — solo prueba "esta persona resolvió Turnstile hace poco"). `mint_initial_tokens` (unirse a cualquier sala / crear una sin contraseña), `create_room_with_password` (crear una sala con contraseña, registra la fila y mintea en la misma llamada), `refresh_access_token` (renueva el access token a partir de un session token válido, sin Turnstile).
- **`bot_guard.py`**: el "mini-servicio" de bloqueo por IP — trackea fallos de Turnstile y de contraseñas de sala incorrectas (en memoria, por instancia), bloqueando temporalmente tras varios fallos en poco tiempo.
- **`errors.py`**: `RoomPasswordInvalidError` (401, retryable), `RoomExpiredError` (410, sala con contraseña vencida — no revive), `RoomAlreadyExistsError` (409), `SessionTokenInvalidError` (401), `JwtSecretMissingError` (sin capturar, 500 si falta el secreto).
- **`cleanup/expire_on_access.py`**: `get_active_room` — sin fila = la sala nunca tuvo contraseña (se trata como abierta); con fila vencida, la purga on-demand (sin worker) **y lanza** `RoomExpiredError` — a diferencia de "nunca tuvo contraseña", una sala que la tuvo y venció no se vuelve pública silenciosamente, queda inutilizable.

## Por qué el `session_token` nunca lleva `role: authenticated`

Si lo llevara, cualquiera que lo consiguiera (aunque sea de mayor duración, pensado solo para renovar el access token sin repetir Turnstile) podría usarlo directo contra Supabase Realtime. Al omitir ese claim, un `session_token` filtrado no sirve para nada frente a las políticas RLS de `realtime.messages` — solo `refresh_access_token` sabe qué hacer con él, y únicamente para mintear un access token nuevo.
