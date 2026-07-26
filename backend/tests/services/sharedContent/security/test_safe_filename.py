from app.services.sharedContent.security.safe_filename import sanitize_file_name


def test_sanitize_quita_traversal_con_barras_unix():
    print("\n[test] sanitize_file_name con path traversal estilo Unix...")
    resultado = sanitize_file_name("../../etc/passwd")

    assert "/" not in resultado
    assert ".." not in resultado
    assert resultado == "passwd"
    print(f"[test] OK: '{resultado}' (sin componentes de ruta).")


def test_sanitize_quita_traversal_con_barras_windows():
    print("\n[test] sanitize_file_name con path traversal estilo Windows...")
    resultado = sanitize_file_name("..\\..\\evil.exe")

    assert "\\" not in resultado
    assert ".." not in resultado
    assert resultado == "evil.exe"
    print(f"[test] OK: '{resultado}' (sin componentes de ruta).")


def test_sanitize_reemplaza_caracteres_fuera_del_allowlist():
    print("\n[test] sanitize_file_name con espacios y simbolos...")
    resultado = sanitize_file_name("mi foto (final)!.png")

    assert resultado == "mi_foto_final_.png"
    print(f"[test] OK: '{resultado}'.")


def test_sanitize_con_nombre_vacio_o_none_usa_fallback():
    print("\n[test] sanitize_file_name con None y con cadena vacia...")
    assert sanitize_file_name(None) == "archivo"
    assert sanitize_file_name("") == "archivo"
    assert sanitize_file_name("   ") == "archivo"
    print("[test] OK: cae al nombre por defecto 'archivo' en los tres casos.")


def test_sanitize_con_nombre_oculto_quita_puntos_iniciales():
    print("\n[test] sanitize_file_name con nombre que empieza en punto...")
    resultado = sanitize_file_name("..env")

    assert not resultado.startswith(".")
    print(f"[test] OK: '{resultado}'.")
