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


settings = Settings()
