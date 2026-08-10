class ChatMediaUnavailableError(Exception):
    """El item de media del chat no existe o ya expiro (mismo criterio de
    "un unico error para todos los casos terminales" que VaultUnavailableError/
    ShareUnavailableError). El router la traduce a HTTP 410 Gone."""
