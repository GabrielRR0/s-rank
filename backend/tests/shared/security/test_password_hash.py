from app.shared.security.password_hash import hash_password, verify_password


def test_hash_password_permite_verificar_con_la_misma_contraseña():
    print("\n[test] hash_password + verify_password con la contraseña correcta...")
    hashed = hash_password("mi-contraseña-123")

    assert verify_password("mi-contraseña-123", hashed) is True
    print("[test] OK: verify_password devolvio True.")


def test_verify_password_rechaza_contraseña_incorrecta():
    print("\n[test] verify_password con contraseña incorrecta...")
    hashed = hash_password("correcta")

    assert verify_password("incorrecta", hashed) is False
    print("[test] OK: verify_password devolvio False.")


def test_hash_password_no_guarda_la_contraseña_en_texto_plano():
    print("\n[test] hash_password no devuelve la contraseña original...")
    hashed = hash_password("secreto")

    assert "secreto" not in hashed
    print("[test] OK: el hash no contiene la contraseña original.")
