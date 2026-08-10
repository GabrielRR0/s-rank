# schemas/secretChatAuth

Modelos Pydantic de la autorización de Realtime del chat secreto — la forma de los datos que entran y salen por HTTP, sin lógica.

## Archivos

- **`secret_chat_auth_schemas.py`**: `CreateRoomRequest` (body de `POST /api/secret-chat/rooms`, solo para salas con contraseña), `RealtimeTokenRequest` (body de `POST /api/secret-chat/realtime-token`, `password` opcional según si la sala la tiene), `RefreshTokenRequest` (body del refresh), `InitialTokenResponse` (par de tokens: `access_token` corto que Supabase entiende + `session_token` más largo que solo prueba que se pasó Turnstile recientemente), `RefreshTokenResponse` (solo el `access_token` nuevo).
