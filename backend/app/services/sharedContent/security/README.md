# services/sharedContent/security

Las dos piezas de seguridad del dominio: proteger un share con contraseña, y garantizar que "vista unica" sea una garantia real y no una ilusión del lado del cliente.

## Archivos

- **`password_hash.py`**: `hash_password`/`verify_password` sobre `bcrypt`. La contraseña nunca se guarda en texto plano - `shared_content_service.create_share` guarda solo el hash en `password_hash`.
- **`one_time_access.py`**: `consume_view(share_id, client)` - el unico punto del codigo que "quema" la vista unica. Delega la atomicidad real a `StorageClient.mark_viewed_if_unseen` (una sola sentencia `UPDATE ... WHERE viewed_at IS NULL` en Postgres) y la traduce a `ShareUnavailableError` cuando pierde la carrera.

## Por que la vista unica se consume en el `reveal`, no en el simple `GET` de estado

Si abrir el link (`GET /api/shared-content/{id}`) ya quemara la vista, un bot de previsualizacion de enlaces (WhatsApp, Slack, iMessage - todos hacen un `GET` automatico al link para armar la miniatura antes de que el destinatario humano lo abra) dejaria el contenido inaccesible para el destinatario real. Por eso el flujo se separa en dos pasos: el `GET` solo informa si el share existe/expiro/requiere contraseña (sin tocar `viewed_at`), y unicamente `POST /{id}/reveal` - una accion explicita, nunca disparada por un prefetch automatico - consume la vista.

## Por que la contraseña se valida antes de llamar a `consume_view`

Si se llamara a `consume_view` primero y recien despues se comparara la contraseña, un intento con contraseña incorrecta ya habria quemado la vista unica - el destinatario real, que todavia no probo la contraseña correcta, se quedaria afuera para siempre. `shared_content_service.reveal_share` valida la contraseña contra la fila (leida aparte, sin marcar nada) y solo llama a `consume_view` despues de confirmarla.
