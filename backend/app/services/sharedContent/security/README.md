# services/sharedContent/security

Todas las piezas de seguridad del dominio: proteger un share con contraseña, garantizar que "vista única" sea una garantía real, encriptar el contenido en reposo, evitar path traversal en nombres de archivo, frenar fuerza bruta por-share, y verificación anti-bot opcional.

## Archivos

- **`password_hash.py`**: `hash_password`/`verify_password` sobre `bcrypt`. La contraseña nunca se guarda en texto plano - `shared_content_service.create_share` guarda solo el hash en `password_hash`.
- **`one_time_access.py`**: `consume_view(share_id, client)` - el único punto del código que "quema" la vista única. Delega la atomicidad real a `StorageClient.mark_viewed_if_unseen` (una sola sentencia `UPDATE ... WHERE viewed_at IS NULL` en Postgres) y la traduce a `ShareUnavailableError` cuando pierde la carrera.
- **`encryption.py`**: `encrypt_bytes`/`decrypt_bytes` con AES-256-GCM. Todo el contenido (texto y archivos) se encripta antes de guardarse en Supabase - ver "Por qué se encripta" más abajo.
- **`safe_filename.py`**: `sanitize_file_name(file_name)` - neutraliza intentos de path traversal en el nombre de archivo subido antes de usarlo para construir la ruta de Storage.
- **`lockout.py`**: `register_failed_attempt(share_id, max_attempts, client)` - lleva la cuenta de intentos de contraseña incorrecta por-share; si se supera el máximo, el share se autodestruye.
- **`turnstile.py`**: `verify_turnstile_token(token)` - verificación anti-bot opcional (Cloudflare Turnstile) en la creación de shares, apagada por defecto vía `TURNSTILE_ENABLED`.
- **`blocked_file_types.py`**: `is_blocked_file_type(file_name, mime_type)` - rechaza extensiones/Content-Type de ejecutables, scripts y documentos de Office con macros antes de aceptar un archivo. Ver "Por qué se bloquea por extensión y no se escanea el contenido" más abajo.

## Por qué la vista única se consume en el `reveal`, no en el simple `GET` de estado

Si abrir el link (`GET /api/shared-content/{id}`) ya quemara la vista, un bot de previsualización de enlaces (WhatsApp, Slack, iMessage - todos hacen un `GET` automático al link para armar la miniatura antes de que el destinatario humano lo abra) dejaría el contenido inaccesible para el destinatario real. Por eso el flujo se separa en dos pasos: el `GET` solo informa si el share existe/expiró/requiere contraseña (sin tocar `viewed_at` ni revelar `file_name` si hace falta contraseña, ver más abajo), y únicamente `POST /{id}/reveal` - una acción explícita, nunca disparada por un prefetch automático - consume la vista.

## Por qué la contraseña se valida antes de llamar a `consume_view`

Si se llamara a `consume_view` primero y recién después se comparara la contraseña, un intento con contraseña incorrecta ya habría quemado la vista única - el destinatario real, que todavía no probó la contraseña correcta, se quedaría afuera para siempre. `shared_content_service.reveal_share` valida la contraseña contra la fila (leída aparte, sin marcar nada) y solo llama a `consume_view` después de confirmarla.

## Por qué se encripta el contenido (y por qué la clave no vive en Supabase)

Sin esto, cualquiera con acceso directo a los datos crudos de Supabase (credenciales filtradas, un volcado de la base, un incidente del lado de Supabase) podría leer el contenido compartido tal cual, incluso después de que la aplicación ya lo hubiera "borrado" lógicamente en algún punto intermedio de una operación. `MASTER_ENCRYPTION_KEY` vive únicamente en las variables de entorno del backend - Supabase guarda el ciphertext, nunca la clave, así que un acceso directo a Supabase no alcanza para leer nada.

## Por qué el nombre de archivo se sanitiza

`shared_content_service.create_share` construye `storage_path` como `f"{share_id}/{nombre}"`. Sin sanitizar, un nombre de archivo con `../` (o `..\` en Windows) podría hacer que esa ruta apunte fuera de la carpeta propia del share dentro del bucket - un path traversal real. `sanitize_file_name` se queda solo con el basename y un allowlist de caracteres seguros, priorizando seguridad sobre preservar el nombre "bonito" tal cual lo escribió el usuario.

## Por qué el bloqueo de intentos fallidos es por-share y no solo por-IP

El rate limit de `/reveal` (ver `app/core/rate_limit.py`) es por IP - un atacante que rota de IP (proxies, botnet) lo esquiva fácil. `lockout.py` lleva la cuenta directamente en la fila del share: sin importar desde cuántas IPs distintas se intente, superado el máximo de intentos el share se autodestruye igual que si hubiera expirado.

## Por qué Turnstile está apagado por defecto

El proyecto depende del rate limiting y el resto de estas protecciones por defecto - Turnstile suma una dependencia externa (cuenta de Cloudflare) y un paso extra de UI, así que queda como capa opcional activable sin tocar código (`TURNSTILE_ENABLED`/`VITE_TURNSTILE_ENABLED`), no como requisito.

## Por qué se bloquea por extensión/Content-Type y no se escanea el contenido real del archivo

Un escaneo de malware de verdad (tipo VirusTotal) necesitaría mandar el archivo en texto plano a un servicio externo *antes* de encriptarlo - rompería la promesa central del proyecto de que nadie más que el destinatario ve el contenido, y el tier gratuito de esas APIs (ej. VirusTotal, 4 requests/minuto) ni siquiera alcanza para una demo con tráfico real. `blocked_file_types.py` es una alternativa deliberadamente más modesta: rechaza por nombre/extensión y por el `Content-Type` que declaró el navegador, sin abrir ni inspeccionar el archivo - frena el caso común (alguien comparte un `.exe`/`.vbs`/macro de Office) sin sacrificar la privacidad ni depender de un tercero. Alguien decidido puede evadirlo disfrazando un ejecutable con otra extensión; no es un antivirus, es una primera barrera barata.
