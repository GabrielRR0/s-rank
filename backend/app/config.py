from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    supabase_url: str = ""
    supabase_key: str = ""
    # Nombre del bucket de Supabase Storage donde se guardan los archivos
    # compartidos (el texto plano no pasa por Storage, vive directo en la
    # tabla - ver shared_content_service.create_share).
    supabase_storage_bucket: str = "shared-content"

    # URL del frontend desplegado (produccion), para habilitarla en CORS sin
    # hardcodear el dominio en el codigo. En dev, localhost:5173 siempre
    # queda permitido ademas de esta (ver app/main.py).
    frontend_url: str = ""

    # Backend de almacenamiento del rate limiter (slowapi/limits). "memory://"
    # alcanza para un solo proceso; en serverless con multiples instancias el
    # limite deja de ser estricto porque cada instancia cuenta por separado.
    # Para un limite global real, apuntar a Redis (Upstash tiene free tier).
    rate_limit_storage_uri: str = "memory://"
    # Crear un share es barato (un insert), pero sigue limitado para evitar
    # que alguien llene el storage gratuito de Supabase con spam. Mas
    # estricto que en la primera version (20/min): el contenido que maneja
    # este proyecto es explicitamente delicado.
    rate_limit_create: str = "10/minute"
    # GET de estado es lo que golpean los bots de previsualizacion de
    # enlaces (WhatsApp, Slack, iMessage...) ademas del destinatario real -
    # limite mas laxo que create/reveal.
    rate_limit_status: str = "30/minute"
    # El mas sensible: en la practica es un endpoint de verificacion de
    # contraseña. Sin un limite estricto por IP se puede fuerza-bruta una
    # contraseña corta share por share. Ver tambien
    # share_password_max_attempts, que ataca el mismo problema por-share en
    # vez de por-IP (un atacante que rota de IP no lo esquiva).
    rate_limit_reveal: str = "5/minute"

    # Tamaño maximo de body aceptado (bytes). Un poco por encima de
    # max_file_bytes para dejar margen al overhead de multipart/form-data
    # (boundaries, headers de cada campo) sin que ese overhead por si solo
    # dispare el rechazo.
    max_body_bytes: int = 10_500_000
    # Limite real de negocio (10MB, ver README raiz del portafolio). Se
    # valida aparte del body para devolver un mensaje 422 preciso en vez de
    # depender solo del 413 generico del middleware de body.
    max_file_bytes: int = 10_000_000

    # Clave maestra (32 bytes en base64) para encriptar el contenido antes
    # de guardarlo en Supabase (AES-256-GCM, ver
    # services/sharedContent/security/encryption.py). Sin default a
    # proposito: si falta, encriptar debe fallar explicito, no guardar
    # datos sin encriptar silenciosamente. Generarla con:
    # python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
    master_encryption_key: str = ""

    # Intentos de contraseña incorrecta permitidos por share antes de
    # autodestruirlo (ver security/lockout.py). Por encima de
    # rate_limit_reveal a proposito, para no interferir con ese limite.
    share_password_max_attempts: int = 8

    # Turnstile (captcha invisible de Cloudflare) en la creacion de shares.
    # Apagado por defecto: el proyecto depende del rate limiting y el resto
    # del hardening por defecto; se puede prender sin tocar codigo seteando
    # estas dos variables (mas VITE_TURNSTILE_ENABLED/SITE_KEY del lado del
    # frontend).
    turnstile_enabled: bool = False
    turnstile_secret_key: str = ""

    # secretVault (Cofre del chat secreto S-Rank): unico dominio del chat
    # que toca el backend (los mensajes van por Supabase Realtime Broadcast,
    # nunca por aca - ver app/services/secretVault/README.md). Mismos
    # nombres de proyecto Supabase que sharedContent, ninguna credencial
    # nueva. Limites separados de los de sharedContent porque es un recurso
    # distinto (texto corto, no archivos).
    rate_limit_vault_create: str = "20/minute"
    rate_limit_vault_status: str = "60/minute"
    rate_limit_vault_copy: str = "30/minute"
    # Un secreto de Cofre es texto corto (una contraseña, no un archivo) -
    # techo bajo a proposito, muy por debajo de max_body_bytes.
    vault_max_ciphertext_bytes: int = 8000

    # secretChatAuth: autoriza que canales de Supabase Realtime (Broadcast/
    # Presence del chat) solo los use gente que paso por este backend -
    # ver backend/README.md seccion 13. Distinto del JWT Secret de Supabase
    # que YA existia (SUPABASE_KEY es la service_role key, un tipo de
    # credencial totalmente distinto) - este es el "JWT Secret" de
    # Project Settings -> API, usado para firmar tokens propios. Sin
    # default a proposito, igual que master_encryption_key: si falta,
    # mintear un token debe fallar explicito, no firmar con un secreto vacio.
    supabase_jwt_secret: str = ""
    # 5 min: vida del access token, el unico que las politicas RLS de
    # Supabase realmente exigen. Corto a proposito (ver doc de Supabase:
    # "keep JWT expiration windows short").
    realtime_access_ttl_seconds: int = 300
    # 45 min: cuanto puede una sesion "coastear" refrescando el access
    # token en segundo plano sin volver a resolver Turnstile.
    realtime_session_ttl_seconds: int = 2700
    # 7 dias: vida de una sala CON contraseña antes de purgarse on-access
    # (sin worker, mismo criterio que el resto del proyecto). Las salas sin
    # contraseña nunca generan fila, no les aplica este limite.
    secret_chat_room_ttl_seconds: int = 604800
    rate_limit_realtime_rooms: str = "10/minute"
    rate_limit_realtime_token: str = "20/minute"
    rate_limit_realtime_refresh: str = "60/minute"
    # bot_guard: bloqueo temporal por IP tras varios fallos de Turnstile o
    # de contraseña de sala en poco tiempo - ver services/secretChatAuth/bot_guard.py.
    bot_guard_max_failures: int = 5
    bot_guard_window_seconds: int = 600
    bot_guard_block_seconds: int = 1800

    # secretChatMedia: imagenes/audio del chat enviados como mensaje normal
    # (no al Cofre) - a diferencia del resto de los mensajes, estos SI pasan
    # por este backend (decision deliberada, ver services/secretChatMedia/README.md:
    # evita el techo real de ~256KB de Supabase Realtime Broadcast). El
    # backend nunca ve el contenido real - solo bytes ya cifrados en el
    # navegador con la clave de la sala.
    secret_chat_media_bucket: str = "secret-chat-media"
    chat_media_max_bytes: int = 10_000_000
    rate_limit_chat_media_create: str = "20/minute"
    rate_limit_chat_media_status: str = "60/minute"

    # Extension del Cofre (secretVault) para guardar imagenes/audio ademas
    # de texto corto - mismo cifrado de punta a punta, pero el contenido
    # pasa a vivir en Supabase Storage (bucket separado del de arriba, un
    # Cofre agotado/vencido borra su propio archivo, ver
    # services/secretVault/cleanup/expire_on_access.py).
    supabase_vault_media_bucket: str = "secret-vault-media"
    vault_media_max_bytes: int = 10_000_000


settings = Settings()
