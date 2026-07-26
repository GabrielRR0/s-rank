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
    # que alguien llene el storage gratuito de Supabase con spam.
    rate_limit_create: str = "20/minute"
    # GET de estado es lo que golpean los bots de previsualizacion de
    # enlaces (WhatsApp, Slack, iMessage...) ademas del destinatario real -
    # limite mas laxo que create/reveal.
    rate_limit_status: str = "30/minute"
    # El mas sensible: en la practica es un endpoint de verificacion de
    # contraseña. Sin un limite estricto por IP se puede fuerza-bruta una
    # contraseña corta share por share.
    rate_limit_reveal: str = "10/minute"

    # Tamaño maximo de body aceptado (bytes). Un poco por encima de
    # max_file_bytes para dejar margen al overhead de multipart/form-data
    # (boundaries, headers de cada campo) sin que ese overhead por si solo
    # dispare el rechazo.
    max_body_bytes: int = 10_500_000
    # Limite real de negocio (10MB, ver README raiz del portafolio). Se
    # valida aparte del body para devolver un mensaje 422 preciso en vez de
    # depender solo del 413 generico del middleware de body.
    max_file_bytes: int = 10_000_000


settings = Settings()
