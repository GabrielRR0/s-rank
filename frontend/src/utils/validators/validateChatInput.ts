export const MAX_NICKNAME_LENGTH = 24
export const MAX_MESSAGE_LENGTH = 2000
// Techo bajo a proposito - el Cofre es para un secreto corto (una
// contraseña), no un documento; coincide con VAULT_MAX_CIPHERTEXT_BYTES del
// backend (ver backend/app/config.py), que limita el ciphertext ya cifrado
// (mas largo que el texto plano por el overhead de base64 + tag de GCM).
export const MAX_VAULT_SECRET_LENGTH = 4000

export function validateNicknameInput(apodo: string, requiredMessage: string, tooLongMessage: string): string[] {
  if (!apodo.trim()) return [requiredMessage]
  if (apodo.length > MAX_NICKNAME_LENGTH) return [tooLongMessage]
  return []
}

export function validateMessageInput(texto: string, tooLongMessage: string): string[] {
  if (texto.length > MAX_MESSAGE_LENGTH) return [tooLongMessage]
  return []
}

export function validateVaultSecretInput(secreto: string, requiredMessage: string, tooLongMessage: string): string[] {
  if (!secreto.trim()) return [requiredMessage]
  if (secreto.length > MAX_VAULT_SECRET_LENGTH) return [tooLongMessage]
  return []
}
