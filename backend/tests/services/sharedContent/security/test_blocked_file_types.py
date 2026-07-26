from app.services.sharedContent.security.blocked_file_types import is_blocked_file_type


def test_bloquea_ejecutable_de_windows_por_extension():
    print("\n[test] is_blocked_file_type con 'factura.exe'...")
    assert is_blocked_file_type("factura.exe", "application/octet-stream") is True
    print("[test] OK: bloqueado por extension.")


def test_bloquea_script_por_extension():
    print("\n[test] is_blocked_file_type con 'instalador.vbs'...")
    assert is_blocked_file_type("instalador.vbs", None) is True
    print("[test] OK: bloqueado por extension.")


def test_bloquea_office_con_macros_por_extension():
    print("\n[test] is_blocked_file_type con 'reporte.docm'...")
    assert is_blocked_file_type("reporte.docm", None) is True
    print("[test] OK: bloqueado por extension.")


def test_bloquea_por_mime_type_aunque_la_extension_sea_inocua():
    print("\n[test] is_blocked_file_type con extension .bin pero mime type de ejecutable...")
    assert is_blocked_file_type("cosa.bin", "application/x-msdownload") is True
    print("[test] OK: bloqueado por Content-Type declarado.")


def test_no_bloquea_extension_no_listada_con_mime_normal():
    print("\n[test] is_blocked_file_type con 'foto.png'...")
    assert is_blocked_file_type("foto.png", "image/png") is False
    print("[test] OK: no bloqueado.")


def test_no_bloquea_documentos_de_office_sin_macros():
    print("\n[test] is_blocked_file_type con 'contrato.docx'...")
    assert is_blocked_file_type("contrato.docx", None) is False
    print("[test] OK: no bloqueado (.docx sin macros esta permitido).")


def test_no_es_sensible_a_mayusculas_en_la_extension():
    print("\n[test] is_blocked_file_type con 'VIRUS.EXE' en mayusculas...")
    assert is_blocked_file_type("VIRUS.EXE", None) is True
    print("[test] OK: bloqueado sin importar mayusculas/minusculas.")


def test_sin_extension_no_rompe():
    print("\n[test] is_blocked_file_type con un nombre sin extension...")
    assert is_blocked_file_type("archivo_sin_extension", None) is False
    print("[test] OK: no bloqueado, no lanzo excepcion.")
