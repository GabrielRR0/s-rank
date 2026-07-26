class ShareUnavailableError(Exception):
    """El share no existe, ya expiro, o ya fue visto una vez (vista unica).

    Se modela como un unico tipo de error (no "not found" vs "gone" por
    separado) porque, desde la perspectiva del destinatario, las tres
    situaciones son indistinguibles y equivalentes: el link ya no sirve. El
    router la traduce a HTTP 410 Gone.
    """


class ShareUnauthorizedError(Exception):
    """El share requiere contraseña y no se dio la correcta.

    Se modela aparte de ShareUnavailableError porque, a diferencia de un
    link muerto, el destinatario real puede reintentar - el router la
    traduce a HTTP 401, no a 410, y la vista unica no se consume (ver
    shared_content_service.reveal_share).
    """
