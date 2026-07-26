# Extensiones que, en la practica, casi siempre corresponden a ejecutables,
# instaladores o scripts capaces de correr codigo por si solos al abrirlos -
# el vector clasico de "alguien comparte un .exe disfrazado de factura".
# Deliberadamente amplio (incluye .js/.sh, que tambien tienen usos legitimos
# como codigo fuente) porque este proyecto prioriza seguridad sobre
# cobertura de casos de uso - ver README para el tradeoff.
BLOCKED_EXTENSIONS = {
    # Windows: ejecutables, instaladores, scripts
    "exe", "dll", "msi", "msp", "com", "scr", "pif", "gadget", "application",
    "bat", "cmd", "vb", "vbs", "vbe", "js", "jse", "ws", "wsf", "wsh",
    "ps1", "ps1xml", "ps2", "ps2xml", "psc1", "psc2", "psm1",
    "msh", "msh1", "msh2", "msh1xml", "msh2xml",
    "reg", "scf", "lnk", "inf", "sct", "hta", "cpl", "msc",
    # macOS / Linux: ejecutables e instaladores
    "app", "command", "dmg", "pkg", "deb", "rpm", "run", "sh", "bin", "out",
    # Documentos de Office con macros (pueden ejecutar codigo VBA)
    "docm", "dotm", "xlsm", "xltm", "xlam", "pptm", "potm", "ppam", "ppsm", "sldm",
    # Android / Java (bytecode ejecutable)
    "apk", "jar",
}

BLOCKED_MIME_TYPES = {
    "application/x-msdownload",
    "application/x-msdos-program",
    "application/x-executable",
    "application/x-dosexec",
    "application/vnd.microsoft.portable-executable",
    "application/x-sh",
    "application/x-bat",
    "application/x-ms-installer",
    "application/vnd.ms-excel.sheet.macroenabled.12",
    "application/vnd.ms-word.document.macroenabled.12",
    "application/vnd.ms-powerpoint.presentation.macroenabled.12",
    "application/java-archive",
    "application/vnd.android.package-archive",
}


def is_blocked_file_type(file_name: str, mime_type: str | None) -> bool:
    """Rechaza por extension y/o Content-Type declarado - no inspecciona el
    contenido real del archivo (eso implicaria mandar el archivo en texto
    plano a un escaner externo antes de encriptarlo, lo que rompe la
    promesa de privacidad del proyecto - ver README seccion 11). Alguien
    decidido puede evadir esto disfrazando un ejecutable con otra
    extension; frena el caso comun, no es un antivirus.
    """
    extension = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if extension in BLOCKED_EXTENSIONS:
        return True
    if mime_type and mime_type.split(";")[0].strip().lower() in BLOCKED_MIME_TYPES:
        return True
    return False
