import re


# "+" (no solo un caracter): colapsa corridas de simbolos consecutivos en un
# unico "_" (ej. " (" -> "_", no "__") para un resultado mas legible.
_CARACTERES_PERMITIDOS = re.compile(r"[^\w.\-]+")


def sanitize_file_name(file_name: str | None) -> str:
    """Neutraliza el nombre de archivo que manda el cliente antes de usarlo
    para construir `storage_path` (`{share_id}/{nombre}`) o de guardarlo en
    la fila.

    Sin esto, un nombre como '../../otro-share/secreto' o uno con
    separadores de ruta podria escribir/leer fuera de la carpeta propia del
    share dentro del bucket (path traversal). Se prioriza seguridad sobre
    estetica: nombres con espacios, acentos u otros simbolos quedan
    normalizados a guion bajo en vez de intentar preservarlos "bonitos".
    """
    nombre = (file_name or "").strip()
    # Solo el basename: descarta cualquier componente de ruta, sea con "/"
    # (Unix/URL) o "\" (Windows) - un atacante podria usar cualquiera de
    # los dos sin importar en que SO corre el backend.
    nombre = nombre.replace("\\", "/").rsplit("/", 1)[-1]
    nombre = _CARACTERES_PERMITIDOS.sub("_", nombre)
    nombre = nombre.lstrip(".")  # evita "..", ".env", nombres ocultos
    return nombre or "archivo"
