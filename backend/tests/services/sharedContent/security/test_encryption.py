import base64

import pytest

from app.config import settings
from app.services.sharedContent.security.encryption import EncryptionKeyError, decrypt_bytes, encrypt_bytes


def test_encrypt_decrypt_roundtrip_devuelve_el_texto_original():
    print("\n[test] encrypt_bytes + decrypt_bytes roundtrip...")
    plaintext = b"contenido secreto de prueba"

    ciphertext, nonce = encrypt_bytes(plaintext)
    resultado = decrypt_bytes(ciphertext, nonce)

    assert resultado == plaintext
    assert ciphertext != plaintext
    print("[test] OK: el contenido desencriptado coincide con el original y el ciphertext no es igual al plaintext.")


def test_mismo_plaintext_produce_ciphertexts_distintos():
    print("\n[test] encrypt_bytes con el mismo plaintext dos veces...")
    plaintext = b"hola mundo"

    ciphertext1, nonce1 = encrypt_bytes(plaintext)
    ciphertext2, nonce2 = encrypt_bytes(plaintext)

    assert ciphertext1 != ciphertext2
    assert nonce1 != nonce2
    print("[test] OK: nonces y ciphertexts distintos en cada operacion (nonce random por operacion).")


def test_decrypt_con_ciphertext_manipulado_falla():
    print("\n[test] decrypt_bytes con ciphertext alterado...")
    ciphertext, nonce = encrypt_bytes(b"contenido original")
    ciphertext_alterado = bytes([ciphertext[0] ^ 0xFF]) + ciphertext[1:]

    with pytest.raises(EncryptionKeyError):
        decrypt_bytes(ciphertext_alterado, nonce)
    print("[test] OK: la alteracion del ciphertext hizo fallar la verificacion de integridad de GCM.")


def test_decrypt_con_nonce_incorrecto_falla():
    print("\n[test] decrypt_bytes con el nonce de otra operacion...")
    ciphertext, _ = encrypt_bytes(b"contenido original")
    _, otro_nonce = encrypt_bytes(b"otro contenido")

    with pytest.raises(EncryptionKeyError):
        decrypt_bytes(ciphertext, otro_nonce)
    print("[test] OK: el nonce incorrecto hizo fallar la desencriptacion.")


def test_encrypt_sin_master_key_configurada_lanza_error_claro(monkeypatch):
    print("\n[test] encrypt_bytes sin MASTER_ENCRYPTION_KEY configurada...")
    monkeypatch.setattr(settings, "master_encryption_key", "")

    with pytest.raises(EncryptionKeyError):
        encrypt_bytes(b"algo")
    print("[test] OK: lanzo EncryptionKeyError en vez de guardar algo sin encriptar.")


def test_encrypt_con_master_key_de_largo_invalido_lanza_error_claro(monkeypatch):
    print("\n[test] encrypt_bytes con MASTER_ENCRYPTION_KEY de largo invalido...")
    monkeypatch.setattr(settings, "master_encryption_key", base64.b64encode(b"clave-muy-corta").decode())

    with pytest.raises(EncryptionKeyError):
        encrypt_bytes(b"algo")
    print("[test] OK: lanzo EncryptionKeyError por no decodificar a 32 bytes.")
