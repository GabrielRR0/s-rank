# Backend — S-Rank (FastAPI)

Backend de las dos misiones del proyecto. **Compartir algo sensible**: texto o archivo detrás de un enlace de visualización única (`sharedContent`). **Chat secreto**: salas de chat efímero 100% cliente-a-cliente vía Supabase Realtime — este backend solo interviene en tres piezas puntuales: el "Cofre" con límite de copias (`secretVault`), la autorización para usar Realtime (`secretChatAuth`), e imagen/audio del chat (`secretChatMedia`). Sin colas ni workers en segundo plano — todo ocurre en la misma request HTTP, para funcionar en hosting serverless gratuito.

## 1. Qué hace este backend, en una línea

Recibe texto o un archivo (`POST /api/shared-content`) y devuelve un id de enlace; ese enlace sirve el contenido **una sola vez** (`POST /api/shared-content/{id}/reveal`) y lo borra físicamente después, o al expirar el tiempo elegido — lo que ocurra primero.

## 2. Requisitos

- Python 3.12+ (`python --version`).
- Un proyecto gratuito en [Supabase](https://supabase.com) (Postgres + Storage).

## 3. Cómo ejecutarlo paso a paso

> **¿Ya corriste esto antes en esta máquina?** (venv creado, dependencias instaladas, `.env` completo, tablas de Supabase ya existen) — no hace falta releer todo, son 2 comandos desde `backend/`:
> ```
> .venv\Scripts\Activate.ps1
> uvicorn app.main:app --reload --port 8000
> ```
> (`source .venv/Scripts/activate` en Git Bash, `source .venv/bin/activate` en macOS/Linux, en vez del primero). Si `uvicorn` no se reconoce como comando después de esto, el venv no se activó — confirmalo mirando si el prompt empieza con `(.venv)`. Si es la primera vez en esta máquina, seguí los 5 pasos completos de abajo.

Todo desde la carpeta `backend/`. Estos 5 pasos alcanzan para tener corriendo la misión **Compartir algo sensible**. Si además querés probar **Chat secreto** en local, hace falta configuración adicional de Supabase — ver el aviso al final de esta sección, no la saltees pensando que ya terminaste.

**Paso 1 — Entorno virtual**
```
python -m venv .venv
```
Activarlo (elegí tu shell/sistema operativo):
- PowerShell (Windows): `.venv\Scripts\Activate.ps1` — si falla por política de ejecución: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- cmd.exe (Windows): `.venv\Scripts\activate.bat`
- Git Bash (Windows): `source .venv/Scripts/activate`
- macOS / Linux: `source .venv/bin/activate`
- A prueba de fallos, sin activar nada (Windows): `.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`; (macOS/Linux): `.venv/bin/python -m uvicorn app.main:app --reload --port 8000`

**Paso 2 — Dependencias**
```
pip install -r requirements.txt
```

**Paso 3 — Proyecto de Supabase**: crear uno gratis en [supabase.com](https://supabase.com), luego en **SQL Editor** pegar y correr todo [`backend/supabase_setup.sql`](supabase_setup.sql) de una sola vez — es el único lugar del proyecto con el SQL real, no hay que ir juntando bloques de distintas secciones de este README. Cubre `shared_content` (esta misión) y, de paso, las tablas del chat (secciones 12/14/15) — correrlas de más aunque no uses el chat no rompe nada.

En **Storage**, crear un bucket privado `s-rank-content` (los otros 2 buckets del chat, `secret-vault-media` y `secret-chat-media`, solo hacen falta si vas a probar Chat secreto - ver el aviso al final de esta sección).

**Paso 4 — Variables de entorno**: copiar `.env.example` a `.env`. Casi todas ya vienen con un default razonable (ver sección 7) — de esa lista larga, solo estas son **obligatorias** para que el server arranque y funcione:
- `SUPABASE_URL` / `SUPABASE_KEY`: en **Project Settings → API**, copiar la **URL** y la **service_role key** (no la `anon` — el backend borra objetos de Storage).
- `MASTER_ENCRYPTION_KEY`: generarla con
  ```
  python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
  ```
  y pegar el resultado tal cual. Sin esta clave el backend arranca igual, pero cualquier creación/revelado de share falla explícito — nunca se guarda contenido sin cifrar por un error de configuración.

`FRONTEND_URL` se puede dejar vacío en local: `localhost:5173` ya está permitido en CORS sin configurar nada.

**Paso 5 — Levantarlo**
```
uvicorn app.main:app --reload --port 8000
```
Cómo confirmar que funciona: abrir `http://localhost:8000/docs` en el navegador — si carga el Swagger UI, el server está corriendo y conectado.

> **¿Vas a probar el Chat secreto además de "Compartir algo sensible"?** El SQL ya está cubierto si corriste `supabase_setup.sql` completo (Paso 3) - falta solo esto, nada de SQL:
> 1. Los 2 buckets de Storage que quedaron pendientes: `secret-vault-media`, `secret-chat-media` (privados, igual que `s-rank-content`).
> 2. `SUPABASE_JWT_SECRET` en `.env` (**Project Settings → API → JWT Settings** - distinto de `SUPABASE_KEY`).
> 3. **Project Settings → Realtime**: desactivar "Allow public access" - sin esto, las políticas de `realtime.messages` quedan bypasseadas. Ver sección 14 para el detalle de por qué y cuándo conviene hacerlo.
>
> Sin este setup extra, `POST /api/shared-content` funciona perfecto pero cualquier endpoint de `/api/secret-chat*` falla. El detalle/rationale de cada pieza está en las secciones **12** (Cofre/Cápsula), **14** (autorización de Realtime) y **15** (imagen/audio del chat).

## 4. Cómo correr los tests

```
pytest
```
No hace falta Supabase configurado — un fake en memoria reemplaza el storage real (`tests/conftest.py`, `app/shared/storage/README.md`). `ModuleNotFoundError: No module named 'app'` significa que el venv no está activo.

## 5. Estructura del proyecto

```
app/
  main.py                # entrypoint: FastAPI, middlewares, CORS, router
  config.py              # configuración vía .env
  core/rate_limit.py     # slowapi Limiter
  routers/ services/ schemas/    # una carpeta por dominio (sharedContent, secretVault, secretChatAuth, secretChatMedia) - cada una con su propio README.md
  shared/storage/        # clientes de Supabase por dominio
  shared/security/       # utilidades genéricas (Turnstile, hash de contraseñas)
tests/                   # espejo de app/, un archivo de test por módulo con lógica
```
Sin `__init__.py` (namespace packages implícitos) — la documentación vive en el `README.md` de cada carpeta.

## 6. Flujo interno (de la subida al borrado)

1. `POST /api/shared-content`: texto va directo a Postgres; un archivo sube a Storage y solo la ruta queda en Postgres. Devuelve `{id, url_path, expires_at}`.
2. `GET /api/shared-content/{id}`: informa si existe/expiró/pide contraseña, **sin consumir la vista** (un bot de previsualización de enlaces no debe quemarla con un simple `GET`).
3. `POST /api/shared-content/{id}/reveal`: valida contraseña, marca `viewed_at` con un `UPDATE ... WHERE viewed_at IS NULL` atómico, lee el contenido y recién ahí borra el archivo y la fila.

## 7. Variables de entorno

- `SUPABASE_URL` / `SUPABASE_KEY`: credenciales de Supabase.
- `SUPABASE_STORAGE_BUCKET`: default `s-rank-content`.
- `FRONTEND_URL`: se suma a CORS junto a `localhost:5173`.
- `RATE_LIMIT_CREATE` / `RATE_LIMIT_STATUS` / `RATE_LIMIT_REVEAL`: límites por IP.
- `RATE_LIMIT_STORAGE_URI`: `memory://` alcanza para un proceso; con varias instancias serverless, usar Redis (Upstash) para un límite global real.
- `MAX_BODY_BYTES` / `MAX_FILE_BYTES`: techo de tamaño de request/archivo (negocio: 10MB).
- `MASTER_ENCRYPTION_KEY`: clave de 32 bytes (base64) para cifrar todo antes de guardarlo. Obligatoria, sin default.
- `SHARE_PASSWORD_MAX_ATTEMPTS`: intentos de contraseña por share antes de autodestruirlo (default `8`).
- `TURNSTILE_ENABLED` / `TURNSTILE_SECRET_KEY`: captcha invisible de Cloudflare, apagado por defecto.
- `RATE_LIMIT_VAULT_CREATE/STATUS/COPY`, `VAULT_MAX_CIPHERTEXT_BYTES`: Cofre (sección 12).
- `SUPABASE_JWT_SECRET` (**distinto** de `SUPABASE_KEY`, Project Settings → API → JWT Settings), `REALTIME_ACCESS_TTL_SECONDS`/`REALTIME_SESSION_TTL_SECONDS`/`SECRET_CHAT_ROOM_TTL_SECONDS`, `RATE_LIMIT_REALTIME_ROOMS/TOKEN/REFRESH`, `BOT_GUARD_MAX_FAILURES/WINDOW_SECONDS/BLOCK_SECONDS`: autorización de Realtime del chat (sección 14).

## 8. Sobre Supabase

El archivo se sube en un request y se descarga en otro — potencialmente otra instancia del backend en un hosting serverless — así que necesita vivir en un storage externo compartido desde el día uno. Primer proyecto del portafolio que implementa de verdad la carpeta `shared/storage/`.

## 9. Protecciones del backend (rate limiting y hardening)

- **Rate limiting por IP** (`slowapi`): `create` 10/min, `status` 30/min, `reveal` 5/min (el más estricto — en la práctica verifica contraseñas). IP real leída de `X-Forwarded-For` (detrás del edge de Vercel).
- **Bloqueo por intentos fallidos de contraseña, por-share**: además del límite por IP, cada share lleva su propio contador; al superarlo se autodestruye.
- **Contenido y `file_name` cifrados en reposo** (AES-256-GCM, nonces separados) — ni siquiera acceso directo a la tabla revela el nombre real; la ruta de Storage tampoco lo incluye.
- **Nombres de archivo sanitizados**: se descarta cualquier componente de ruta antes de construir la ruta de Storage (cierra un path traversal real de la v1).
- **`Origin` verificado** (capa extra sobre CORS, `403` si no coincide) y **headers de seguridad** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS) en todas las respuestas.
- **Límites de tamaño**: `413` por `Content-Length` antes de llegar a Supabase, `422` propio si el archivo supera `MAX_FILE_BYTES`.
- **Bloqueo de tipos de archivo peligrosos** por extensión/`Content-Type` (ejecutables, scripts, Office con macros) — no es un antivirus, no inspecciona el contenido real.
- **Contraseñas con `bcrypt`**, nunca logueadas. **Turnstile opcional**, apagado por defecto.

## 10. Decisiones de arquitectura

- Texto directo en Postgres, archivos en Storage: evita un viaje a Storage por dos líneas de texto.
- La vista única se consume solo en `/reveal`, nunca en el `GET` de estado (bots de previsualización de enlaces harían un `GET` automático).
- La contraseña se valida antes de consumir la vista — un intento fallido no debe gastarla.
- Atomicidad vía un único `UPDATE ... WHERE viewed_at IS NULL`, resuelto por Postgres — no un lock en Python.
- `StorageClient` como `Protocol` + `Depends()`: permite testear todo (incluida la carrera de la vista única) con un fake en memoria.
- Sin worker de limpieza: la expiración se resuelve on-demand, en el próximo acceso (limitación conocida: un link nunca reabierto queda en Supabase indefinidamente).
- Expiración tope de 24hs (antes 7 días): contenido delicado, se espera que se vea casi de inmediato.

## 11. Preguntas de seguridad

**¿Se guarda cifrado?** Sí — Postgres/Storage, AES-256-GCM, clave (`MASTER_ENCRYPTION_KEY`) solo en variables de entorno del backend. Un volcado de Supabase expondría bytes ilegibles, no contenido real.

**¿Solo este frontend puede llamar a la API?** No de forma absoluta — ninguna SPA pública sin cuentas puede garantizarlo (cualquiera puede copiar el request con DevTools y repetirlo por `curl`); una "API key" en el frontend no cambiaría nada, sería visible en el bundle. Lo que sí suma protección real: verificación de `Origin`, rate limiting + bloqueo por-share, y Turnstile opcional.

**¿Se puede adivinar un enlace?** No es viable: `share_id` es un UUID v4 (122 bits de aleatoriedad real). No hay endpoint que liste shares, RLS sin políticas públicas tapa un acceso directo a la tabla, y `RATE_LIMIT_STATUS` es una capa extra (aunque irrelevante frente a ese espacio de ids).

**Riesgo real que sí se cerró: fuga del id vía `Referer`.** El id vive en la URL (`/s/{id}`); sin protección, navegar a un link externo desde esa página filtraría la URL completa como `Referer`. Se agregó `<meta name="referrer" content="no-referrer">` en `frontend/index.html`.

**¿Contenido malicioso?** HTML/`<script>` en texto no es riesgo (Vue interpola con `{{ }}`, sin `v-html` en el proyecto). Archivos: `blocked_file_types.py` frena ejecutables/scripts/macros conocidos por extensión y `Content-Type`, pero no es un antivirus — no inspecciona el contenido real ni detecta un ejecutable renombrado. Escanear de verdad implicaría mandar el archivo en claro a un servicio externo antes de cifrarlo, lo que contradice la promesa central del proyecto — se optó por no cruzar esa línea. Como red adicional fuera de nuestro control: Safe Browsing/SmartScreen suelen escanear archivos descargados independientemente.

## 12. Cofre del chat secreto S-Rank (`secretVault`)

Segunda misión: salas de chat efímero (2-6 personas, ver `frontend/src/components/secretChat/README.md`). Los mensajes normales viajan por Supabase Realtime Broadcast y nunca tocan este backend ("Zero-Log"). Este backend solo administra el **Cofre**: compartir un dato sensible con un límite real de copias, porque varias personas pueden intentar copiarlo casi al mismo tiempo y eso necesita una garantía atómica. **Nunca ve el contenido en texto plano** — recibe `ciphertext`/`nonce` ya cifrados con una clave que vive solo en el fragmento de la URL de la sala; solo cuenta copias y expiración.

Tabla `secret_vault_items` + función `decrement_vault_copies`: SQL completo en [`supabase_setup.sql`](supabase_setup.sql) (bloque 2), mismas credenciales que `sharedContent` — no hace falta un proyecto nuevo. Bucket privado nuevo: `secret-vault-media` (solo para items de imagen/audio).

**Por qué una función SQL y no un `.update()` normal**: el query builder de `supabase-py` solo acepta valores literales, no puede expresar `remaining_copies - 1` como relativo al valor anterior — leerlo y restarlo en Python abriría una carrera entre dos requests casi simultáneas. La función resuelve todo ("restar 1, si sigue > 0 y no expiró") en una sola sentencia con lock de fila en Postgres, mismo principio que `mark_viewed_if_unseen` en `sharedContent`.

**Endpoints**: `POST /api/secret-vault` (texto, `max_copies` 1-6 y `ttl_seconds` contra allowlists fijas) · `POST /api/secret-vault/media` (imagen/audio, multipart, sube a Storage) · `GET /api/secret-vault/{id}` (sin límite de *ver*, solo de copiar; para media, descarga de Storage y devuelve en base64url en el mismo campo `ciphertext`) · `POST /api/secret-vault/{id}/copy` (decrementa atómico; en 0, borra fila + archivo).

**Asimetría deliberada**: el chat normal no pasa por este backend (inherente a "Zero-Log"); el Cofre sí, porque es la pieza realmente sensible, y hereda toda la protección de la sección 9.

**Límite aceptado — cupo de sala (2-6)**: se controla con Presence de Supabase, del lado del cliente — límite suave, no garantía dura. Un cupo real necesitaría una tabla de "asientos" con el mismo patrón atómico de arriba, desproporcionado para una app de amigos sin cuentas.

**Turnstile** (apagado por defecto): mismo flag que `sharedContent` (`TURNSTILE_ENABLED`/`TURNSTILE_SECRET_KEY` + `VITE_TURNSTILE_ENABLED`/`VITE_TURNSTILE_SITE_KEY`) — `secretChatAuth` (sección 14) lo reutiliza también.

## 14. Autorización de Supabase Realtime del chat secreto (`secretChatAuth`)

El chat usa Supabase Realtime con la **anon key**, pública por diseño — sin más, cualquiera con esa key podría abrir canales de Broadcast/Presence, incluso desde otro dominio. Se cierra en capas: `verify_origin` (sección 9) en el endpoint que emite tokens, Turnstile opcional, `bot_guard` (bloqueo por IP tras fallos repetidos), y Realtime Authorization de Supabase exigiendo un token válido.

**Dos tokens**: *access token* (5 min default, `{role: authenticated, room_id, exp}` — el único que Supabase entiende, lo exigen las políticas de abajo) y *session token* (45 min default, sin `role: authenticated` a propósito — nunca sirve como credencial aunque se filtre, solo permite refrescar el access token sin repetir Turnstile hasta que el propio session token vence).

Tabla `secret_chat_rooms` + las policies de RLS sobre `realtime.messages`: SQL completo en [`supabase_setup.sql`](supabase_setup.sql) (bloque 3).

**Paso manual además del SQL** (Project Settings → Realtime): desactivar "Allow public access" — sin esto, RLS queda bypasseado. Reversible al instante; conviene desplegar el código primero, verificar a mano, y recién ahí desactivar el toggle. `SUPABASE_JWT_SECRET` sale de Project Settings → API → JWT Settings (**distinto** de `SUPABASE_KEY`).

**Endpoints**: `POST /api/secret-chat/rooms` (crea sala con contraseña) · `POST /api/secret-chat/realtime-token` (unirse a cualquier sala, o crear una sin contraseña) · `POST /api/secret-chat/realtime-token/refresh` (renueva el access token, sin Turnstile).

**Por qué RLS y no Python**: Supabase ya expone `realtime.topic()` justo para esto — reimplementarlo en Python significaría interponer este backend en cada mensaje, lo que "Zero-Log" evita a propósito.

**Qué bloquea y qué no**: sí bloquea un frontend clonado en un navegador real de otro dominio (no puede falsificar su propio `Origin` ni resolver Turnstile sin el widget real). No bloquea, ni pretende, un navegador real automatizado completo (ej. Chromium headless) — mismo límite de cualquier captcha. `bot_guard` es en memoria por instancia (mismo escape hatch que `RATE_LIMIT_STORAGE_URI`: Redis si hace falta un bloqueo global).

**Contraseña de sala**: propósito distinto de las capas de arriba — no defiende contra clonar el frontend, defiende contra que alguien con el link completo (clave E2EE incluida) igual no entre sin ella. Una sala con contraseña vencida (`SECRET_CHAT_ROOM_TTL_SECONDS`, 7 días default) se purga on-access y no revive.

## 15. Imágenes y audio del chat como mensaje normal (`secretChatMedia`)

Compartir imagen/audio dentro de la conversación normal (no el Cofre), con la misma autodestrucción por TTL que el texto. Rompe a propósito y de forma acotada el diseño "Zero-Log": Broadcast tiene un techo real de ~256KB, insuficiente para foto/audio de calidad razonable, así que esos bytes (cifrados de punta a punta, este backend nunca ve el contenido real) pasan por aquí con el mismo techo (~10MB) que `sharedContent`.

Tabla `secret_chat_media_items`: SQL completo en [`supabase_setup.sql`](supabase_setup.sql) (bloque 4). Bucket privado nuevo: `secret-chat-media`.

**Endpoints**: `POST /api/secret-chat-media` (multipart, sube y devuelve `{id, expires_at}`; el `id` viaja por Broadcast, los bytes nunca) · `GET /api/secret-chat-media/{id}` (purga on-access, **sin límite de copias** — todos los ocupantes conectados necesitan poder leerlo mientras el mensaje esté vivo).

**Por qué la subida es multipart pero la bajada JSON**: FastAPI no mezcla un body JSON con `UploadFile`, y base64 infla el payload de subida ~33% arriesgando `MAX_BODY_BYTES`. La bajada sí puede ser JSON en base64: `reject_oversized_body` solo mide el `Content-Length` del *request* entrante, nunca el de la respuesta — mismo patrón que ya usa el Cofre.

**Limitaciones aceptadas**: `mime_type` viaja sin cifrar (mismo tipo de fuga que `file_type` en `sharedContent`); sin escaneo de tipo de archivo (el backend solo ve bytes cifrados, no tiene sentido); rate limits de estado (60/min) sin ajustar al tamaño nuevo posible (hasta 10MB por respuesta); un audio efímero puede autodestruirse por TTL antes de terminar de reproducirse en salas con TTL corto — consecuencia directa de usar el mismo TTL para todo tipo de mensaje, no se pausa la cuenta regresiva por esto.
