# Backend — File Sharer (FastAPI)

API que comparte texto o un archivo detrás de un enlace temporal, de visualización única. Todo el procesamiento ocurre dentro de la misma request HTTP (sin colas, sin workers en segundo plano), para que funcione en un hosting serverless gratuito sin cold-starts largos.

## 1. Qué hace este backend, en una línea

Recibe texto o un archivo (`POST /api/shared-content`) y devuelve un id de enlace; ese enlace sirve el contenido **una sola vez** (`POST /api/shared-content/{id}/reveal`) y lo borra físicamente después, o al expirar el tiempo elegido — lo que ocurra primero.

## 2. Requisitos

- Python 3.12+ instalado (`python --version` para verificar).
- Un proyecto gratuito en [Supabase](https://supabase.com) (Postgres + Storage) — 

## 3. Cómo ejecutarlo paso a paso

Todos los comandos se corren **desde la carpeta `backend/`**.

### 3.1 Crear el entorno virtual (solo la primera vez)

```
python -m venv .venv
```

### 3.2 Activar el entorno virtual (cada vez que abras una terminal nueva)

**PowerShell** (el prompt empieza con `PS `):
```powershell
.venv\Scripts\Activate.ps1
```
Si da un error de "la ejecución de scripts está deshabilitada en este sistema":
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
y volver a intentar `.venv\Scripts\Activate.ps1`.

**cmd.exe**: `.venv\Scripts\activate.bat`

**Git Bash / bash**: `source .venv/Scripts/activate`

**Alternativa a prueba de fallos** (sin activar nada): invocar siempre el ejecutable de `.venv` explícito:
```
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 3.3 Instalar las dependencias

```
pip install -r requirements.txt
```

### 3.4 Configurar Supabase

1. Crear un proyecto gratuito en [supabase.com](https://supabase.com).
2. En **SQL Editor**, crear la tabla:
   ```sql
   create table shared_content (
     id uuid primary key,
     content_type text not null,
     content_text text,
     storage_path text,
     file_name text,
     file_size integer,
     file_type text,
     password_hash text,
     encryption_nonce text,
     failed_password_attempts integer not null default 0,
     expires_at timestamptz not null,
     viewed_at timestamptz,
     created_at timestamptz not null default now()
   );
   alter table shared_content enable row level security;
   -- Sin políticas públicas a propósito: el backend accede con la service
   -- role key (bypassea RLS); el frontend nunca habla directo con Supabase.
   ```
3. En **Storage**, crear un bucket privado llamado `shared-content`.
4. En **Project Settings → API**, copiar la **URL** y la **service_role key** (no la `anon` key — el backend borra objetos de Storage, algo que la key pública no puede hacer).
5. Copiar `.env.example` a `.env` y completar `SUPABASE_URL` / `SUPABASE_KEY` con esos valores.
6. Generar la clave de encriptación del contenido (ver sección 8) y completar `MASTER_ENCRYPTION_KEY` en el mismo `.env`:
   ```
   python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
   ```
   Sin esta variable, el backend arranca pero cualquier intento de crear o revelar un share falla explícito (a propósito — nunca se guarda contenido sin encriptar por un error de configuración).

### 3.5 Levantar el servidor

```
uvicorn app.main:app --reload --port 8000
```

Probarlo sin el frontend en `http://localhost:8000/docs` (Swagger UI autogenerado).

## 4. Cómo correr los tests

```
pytest
```

**No hace falta Supabase configurado para correr los tests** — reemplazan el cliente real por un fake en memoria (ver `tests/conftest.py` y `app/shared/storage/README.md`). Si ves `ModuleNotFoundError: No module named 'app'`, el venv no está activo (ver 3.2); para descartarlo: `.venv\Scripts\python.exe -m pytest`.

## 5. Estructura del proyecto

```
app/
  main.py                       # entrypoint: FastAPI, middlewares, CORS, router
  config.py                     # configuración vía variables de entorno (.env)
  core/rate_limit.py            # slowapi Limiter
  routers/sharedContent/        # capa HTTP -> ver README.md de la carpeta
  services/sharedContent/       # orquestación, seguridad, cleanup -> ver README.md de la carpeta
  schemas/sharedContent/        # validación de datos (Pydantic) -> ver README.md de la carpeta
  shared/storage/                # cliente de Supabase -> ver README.md de la carpeta
tests/                          # espejo de app/, un archivo de test por módulo con lógica
pytest.ini
requirements.txt
.env.example
```

Sin `__init__.py` en estas carpetas (namespace packages implícitos), cada carpeta con lógica real tiene su propio `README.md`.

## 6. Flujo interno (de la subida al borrado)

1. `POST /api/shared-content`: `shared_content_router` recibe `multipart/form-data` y llama a `shared_content_service.create_share`. Si es texto, se guarda directo en Postgres; si es archivo, se sube a Supabase Storage y solo la ruta queda en Postgres. Devuelve `{id, url_path, expires_at}`.
2. El destinatario abre `/s/{id}` en el frontend, que hace `GET /api/shared-content/{id}` — informa si existe, si expiró y si pide contraseña, **sin revelar nada ni consumir la vista** (para no quemarla con un simple `GET`, ver `services/sharedContent/security/README.md`).
3. Al confirmar (y dar la contraseña si hace falta), el frontend llama a `POST /api/shared-content/{id}/reveal`. El servicio valida la contraseña contra el hash, marca `viewed_at` de forma atómica (`UPDATE ... WHERE viewed_at IS NULL`, ver `app/shared/storage/supabase_client.py`), lee el contenido y **recién ahí** borra el archivo de Storage y la fila de Postgres.

## 7. Variables de entorno

Copiar `.env.example` a `.env`:

- `SUPABASE_URL` / `SUPABASE_KEY`: credenciales del proyecto de Supabase (ver sección 3.4). Sin esto, cualquier endpoint que toque storage falla.
- `SUPABASE_STORAGE_BUCKET`: nombre del bucket (default `shared-content`).
- `FRONTEND_URL`: URL del frontend en producción, sumada a CORS junto a `http://localhost:5173` (siempre permitido en dev).
- `RATE_LIMIT_CREATE` / `RATE_LIMIT_STATUS` / `RATE_LIMIT_REVEAL`: límites por IP (ver sección 9).
- `RATE_LIMIT_STORAGE_URI`: `memory://` alcanza para un proceso; en serverless con varias instancias, apuntar a Redis (Upstash) para un límite realmente global.
- `MAX_BODY_BYTES` / `MAX_FILE_BYTES`: techo de tamaño de request / de archivo (10MB de negocio, con margen extra en el body para el overhead de multipart).
- `MASTER_ENCRYPTION_KEY`: clave de 32 bytes (base64) para encriptar todo el contenido antes de guardarlo (ver sección 8 y sección 11). Obligatoria, sin default.
- `SHARE_PASSWORD_MAX_ATTEMPTS`: intentos de contraseña incorrecta permitidos por share antes de autodestruirlo (default `8`).
- `TURNSTILE_ENABLED` / `TURNSTILE_SECRET_KEY`: captcha invisible de Cloudflare en la creación de shares, apagado por defecto (ver sección 11).

## 8. Sobre Supabase 

 Acá el archivo se sube en un request y se descarga en otro — potencialmente en otra instancia del backend en un hosting serverless — así que necesita vivir en un storage externo compartido desde el día uno. Es, dentro del portafolio, el primer proyecto que implementa de verdad la carpeta `shared/storage/`

## 9. Protecciones del backend (rate limiting y hardening)

- **Rate limiting por IP** (`slowapi`): `create` a 10/min, `status` (el `GET`, que también golpean los bots de previsualización de enlaces) a 30/min, y **`reveal` a 5/min** — el más estricto, porque en la práctica es un endpoint de verificación de contraseña. Clave de rate limit: IP real leída de `X-Forwarded-For` (necesario detrás del edge de Vercel, ver `app/core/rate_limit.py`).
- **Bloqueo por intentos fallidos de contraseña, por-share** (`SHARE_PASSWORD_MAX_ATTEMPTS`, ver `services/sharedContent/security/lockout.py`): además del rate limit por IP, cada share lleva su propio contador — un atacante que rota de IP para esquivar el rate limit no esquiva este. Al superar el máximo, el share se autodestruye (mismo tratamiento que si hubiera expirado).
- **Contenido encriptado en reposo** (AES-256-GCM, ver sección 11 y `services/sharedContent/security/encryption.py`): texto y archivos se encriptan antes de tocar Supabase.
- **Nombres de archivo sanitizados** (`services/sharedContent/security/safe_filename.py`): se descarta cualquier componente de ruta y caracteres fuera de un allowlist antes de usar el nombre para construir la ruta de Storage — cierra un path traversal real que existía en la primera versión.
- **`file_name` oculto hasta verificar la contraseña**: `GET` de estado no revela el nombre del archivo si el share requiere contraseña (se muestra recién junto con el contenido, tras verificarla).
- **Chequeo de header `Origin`** (`app/main.py`): capa adicional a CORS, rechaza con `403` requests cuyo `Origin` no coincide con el frontend conocido — ver sección 11 para el alcance real de esta protección.
- **Límite de tamaño de body** (middleware en `app/main.py`): `Content-Length` mayor a `MAX_BODY_BYTES` corta con `413` antes de llegar a Supabase.
- **Límite de tamaño de archivo** (`MAX_FILE_BYTES`, chequeado en el servicio): da un `422` con mensaje preciso ("el archivo supera el máximo de 10MB") en vez de depender solo del `413` genérico del body.
- **Contraseñas hasheadas con `bcrypt`** (ya de por sí a tiempo constante, sin necesidad de medidas extra contra timing attacks) — nunca se guarda ni se loguea el valor real.
- **Headers de seguridad** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`) en todas las respuestas.
- **CORS** restringido a `localhost:5173` + `FRONTEND_URL`.
- **Turnstile opcional** (`TURNSTILE_ENABLED`, apagado por defecto): captcha invisible en la creación de shares contra bots/spam automatizado, ver sección 11.

## 10. Decisiones de arquitectura (por qué está así)

- **Texto directo en Postgres, archivos en Storage**: evita un viaje a Storage por compartir dos líneas de texto (ver `services/sharedContent/README.md`).
- **La vista única se consume en `/reveal`, nunca en el `GET` de estado**: un bot de previsualización de enlaces (WhatsApp, Slack...) hace un `GET` automático al abrir un link — si eso quemara la vista, el destinatario real se quedaría afuera. Ver `services/sharedContent/security/README.md`.
- **La contraseña se valida antes de consumir la vista**: un intento fallido no debe gastar la única oportunidad de ver el contenido.
- **Atomicidad vía un único `UPDATE ... WHERE viewed_at IS NULL`, no un lock en Python**: es Postgres quien decide, con garantías reales, quién gana cuando dos requests llegan casi al mismo tiempo. Ver `app/shared/storage/supabase_client.py`.
- **`StorageClient` como `Protocol` + inyección con `Depends()`**: permite testear todo el flujo (incluida la condición de carrera de la vista única) con un fake en memoria, sin depender de un proyecto de Supabase real durante `pytest`.
- **Sin worker de limpieza persistente**: la expiración se resuelve on-demand, en el próximo acceso real al link — cumple la regla del portafolio de cero colas/workers 24/7 (con la limitación conocida de que un link nunca vuelto a abrir queda en Supabase indefinidamente; ver `services/sharedContent/cleanup/README.md`).
- **Sin `__init__.py`**: namespace packages implícitos, documentación en el `README.md` de cada carpeta.
- **Expiración tope de 24hs** (antes permitía hasta 7 días): el contenido de este proyecto es delicado y se espera que el destinatario lo vea casi de inmediato, no que quede disponible días "por las dudas".
- **Bloqueo de intentos fallidos por-share con update simple, no un `UPDATE` atómico vía RPC**: a diferencia de `viewed_at`, una carrera improbable acá solo le regala a un atacante un intento extra, no una fuga de contenido — no amerita la complejidad de una función SQL propia.

## 11. Preguntas de seguridad (respondidas explícitamente)

**¿El contenido se guarda en Supabase? ¿Se encripta?** Sí se guarda en Supabase (Postgres para texto/metadata, Storage para archivos), y **sí, todo se encripta** con AES-256-GCM antes de guardarse (`services/sharedContent/security/encryption.py`). La clave (`MASTER_ENCRYPTION_KEY`) vive solo en las variables de entorno del backend — nunca en Supabase, nunca en el frontend. Aunque alguien accediera a los datos crudos de Supabase (credenciales filtradas, un volcado de la base, un incidente del lado de Supabase), el contenido seguiría siendo bytes ilegibles sin esa clave.

**¿Solo este frontend puede llamar a este backend?** No de forma absoluta, y ninguna SPA pública sin cuentas de usuario puede garantizar eso realmente: cualquiera puede abrir las herramientas de desarrollador del navegador, copiar el request exacto que hace el frontend, y repetirlo con `curl`. Una "API key" embebida en el frontend no cambiaría esto — sería visible en el bundle de JavaScript que cualquiera puede leer, así que no protegería nada real (sería seguridad de utilería). Esta es una limitación arquitectónica, no un descuido, y aplica a cualquier SPA + API pública. Lo que sí se suma, con beneficio real:
- El chequeo de `Origin` (sección 9) sube el costo de que *otro sitio web* abuse de la API desde el navegador de una víctima.
- El rate limiting por IP + el bloqueo por intentos fallidos por-share (sección 9) limitan el daño real de cualquier actor automatizado, sin importar si usa este frontend o un script propio.
- Turnstile (ver abajo) suma fricción real contra automatización a gran escala en la creación de shares.

**¿Y contra un atacante con más habilidad?** Además de lo anterior, revisando el código con esa lente se corrigieron dos problemas concretos que sí eran reales: un path traversal en el nombre de archivo subido, y una fuga del nombre del archivo antes de verificar la contraseña (ambos en sección 9).

**¿Se puede "adivinar" un enlace probando ids al azar hasta encontrar uno que exista?** Con los números reales, no es viable. `share_id` es un UUID v4 (`uuid.uuid4()`, que en Python usa `os.urandom()` — un generador criptográficamente seguro, no un `random()` predecible): 122 bits de aleatoriedad real, ~5.3 × 10³⁶ valores posibles. Ni con mil millones de intentos por segundo sostenidos se agotaría ese espacio en un tiempo razonable. Además:
- No existe ningún endpoint que *liste* shares — `GET /api/shared-content/{id}` exige conocer el id de antemano, nunca hay un "catálogo" para navegar. La única forma de "encontrar" un share es adivinar el UUID exacto, no hay atajos.
- Row Level Security en Supabase (sección 3.4, sin políticas públicas) tapa el otro camino posible: aunque se filtrara la `anon key`, sin políticas no se puede hacer un `SELECT * FROM shared_content` para listar ids reales directamente contra la base.
- `RATE_LIMIT_STATUS` (30/min por IP) es una capa extra, pero en la práctica es irrelevante frente a ese tamaño de espacio — lo que realmente hace esto seguro es la aleatoriedad del id, no el límite de requests.

**Un riesgo distinto, y ese sí valía la pena cerrar: fuga del id vía el header `Referer`.** El id del share vive en la URL misma (`/s/{id}`); si esa página cargara algún recurso de un dominio externo, o el destinatario hiciera clic en un link hacia afuera, el navegador podría mandar esa URL completa (id incluido) como `Referer` al sitio de destino — filtrando el "secreto" sin que nadie lo haya adivinado. Se agregó `<meta name="referrer" content="no-referrer">` en `frontend/index.html`, que corta esto en toda la página (no solo en el único link externo que ya tenía protección puntual, `rel="noreferrer"` en el ícono de LinkedIn del footer).

**Turnstile — apagado por defecto.** Para activarlo: crear un widget gratuito en el [dashboard de Cloudflare](https://dash.cloudflare.com/) (modo "Managed" o "Invisible"), y setear `TURNSTILE_ENABLED=true` + `TURNSTILE_SECRET_KEY` acá, más `VITE_TURNSTILE_ENABLED=true` + `VITE_TURNSTILE_SITE_KEY` en `frontend/.env`. Con el flag apagado (default), el backend nunca llama a Cloudflare y el frontend nunca carga su script — cero impacto en el flujo normal.
