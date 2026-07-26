from app.services.sharedContent.security.lockout import register_failed_attempt


def test_register_failed_attempt_devuelve_false_antes_de_llegar_al_maximo(fake_client):
    print("\n[test] register_failed_attempt por debajo del maximo...")
    fake_client.insert_share({"id": "abc", "failed_password_attempts": 0})

    alcanzo_el_maximo = register_failed_attempt("abc", max_attempts=8, client=fake_client)

    assert alcanzo_el_maximo is False
    print("[test] OK: devolvio False (1er intento fallido, maximo 8).")


def test_register_failed_attempt_devuelve_true_al_llegar_al_maximo(fake_client):
    print("\n[test] register_failed_attempt hasta llegar al maximo...")
    fake_client.insert_share({"id": "abc", "failed_password_attempts": 0})

    resultados = [register_failed_attempt("abc", max_attempts=3, client=fake_client) for _ in range(3)]

    assert resultados == [False, False, True]
    print("[test] OK: solo el 3er intento (el que llega al maximo) devolvio True.")


def test_register_failed_attempt_sobre_share_inexistente_no_rompe(fake_client):
    print("\n[test] register_failed_attempt sobre un id inexistente...")
    resultado = register_failed_attempt("no-existe", max_attempts=8, client=fake_client)

    assert resultado is False
    print("[test] OK: no lanzo excepcion, devolvio False.")
