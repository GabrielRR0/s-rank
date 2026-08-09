class VaultUnavailableError(Exception):
    """El item del Cofre no existe, ya expiro, o ya agoto sus copias.

    Un unico tipo de error para los tres casos (igual criterio que
    ShareUnavailableError en sharedContent): desde la perspectiva de quien
    pide el item, las tres situaciones son equivalentes - ya no se puede
    usar. El router la traduce a HTTP 410 Gone.
    """
