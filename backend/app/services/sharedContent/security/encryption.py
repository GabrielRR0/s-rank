import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

# 96 bits: tamaño de nonce recomendado para AES-GCM (el estandar NIST lo
# especifica para el caso comun de nonces aleatorios, no secuenciales).
NONCE_SIZE_BYTES = 12
KEY_SIZE_BYTES = 32  # AES-256


class EncryptionKeyError(Exception):
    """MASTER_ENCRYPTION_KEY falta o esta mal formada."""


def _load_key() -> bytes:
    # Perezoso (no a nivel de modulo): si se decodificara al importar este
    # archivo, importar app.main sin MASTER_ENCRYPTION_KEY configurada (ej.
    # al correr pytest en una maquina nueva) rompería la coleccion de tests
    # que no ejercitan encriptacion. Mismo criterio que get_storage_client.
    if not settings.master_encryption_key:
        raise EncryptionKeyError(
            "MASTER_ENCRYPTION_KEY no esta configurada - ver backend/README.md, seccion de encriptacion."
        )
    try:
        key = base64.b64decode(settings.master_encryption_key, validate=True)
    except Exception as exc:
        raise EncryptionKeyError("MASTER_ENCRYPTION_KEY no es base64 valido.") from exc
    if len(key) != KEY_SIZE_BYTES:
        raise EncryptionKeyError(
            f"MASTER_ENCRYPTION_KEY debe decodificar a exactamente {KEY_SIZE_BYTES} bytes (AES-256)."
        )
    return key


def encrypt_bytes(plaintext: bytes) -> tuple[bytes, bytes]:
    """Encripta con AES-256-GCM. Devuelve (ciphertext_con_tag, nonce).

    GCM es un unico primitivo para confidencialidad *e* integridad: si el
    ciphertext o el nonce se alteran despues (corrupcion, manipulacion),
    decrypt_bytes lanza en vez de devolver basura silenciosamente. El nonce
    no es secreto (se guarda junto al ciphertext, ver
    shared_content_service) - su unico requisito es no repetirse nunca para
    la misma clave, por eso se genera random por cada operacion.
    """
    nonce = os.urandom(NONCE_SIZE_BYTES)
    ciphertext = AESGCM(_load_key()).encrypt(nonce, plaintext, None)
    return ciphertext, nonce


def decrypt_bytes(ciphertext: bytes, nonce: bytes) -> bytes:
    try:
        return AESGCM(_load_key()).decrypt(nonce, ciphertext, None)
    except InvalidTag as exc:
        raise EncryptionKeyError("No se pudo desencriptar: ciphertext, nonce o clave no coinciden.") from exc
