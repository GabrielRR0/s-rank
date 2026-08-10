import { describe, expect, it } from 'vitest'
import {
  MAX_MESSAGE_LENGTH,
  MAX_NICKNAME_LENGTH,
  MAX_VAULT_SECRET_LENGTH,
  validateMessageInput,
  validateNicknameInput,
  validateVaultSecretInput,
} from './validateChatInput'

const REQUERIDO = 'requerido'
const MUY_LARGO = 'muy largo'

describe('validateNicknameInput', () => {
  it('rechaza un apodo vacio', () => {
    expect(validateNicknameInput('', REQUERIDO, MUY_LARGO)).toEqual([REQUERIDO])
  })

  it('rechaza un apodo de solo espacios (usuario que aprieta espacio y manda)', () => {
    expect(validateNicknameInput('   ', REQUERIDO, MUY_LARGO)).toEqual([REQUERIDO])
  })

  it('acepta un apodo justo en el limite', () => {
    const apodo = 'a'.repeat(MAX_NICKNAME_LENGTH)
    expect(validateNicknameInput(apodo, REQUERIDO, MUY_LARGO)).toEqual([])
  })

  it('rechaza un apodo un caracter por encima del limite', () => {
    const apodo = 'a'.repeat(MAX_NICKNAME_LENGTH + 1)
    expect(validateNicknameInput(apodo, REQUERIDO, MUY_LARGO)).toEqual([MUY_LARGO])
  })

  it('acepta un apodo con unicode/emoji dentro del limite', () => {
    expect(validateNicknameInput('日本語😀', REQUERIDO, MUY_LARGO)).toEqual([])
  })

  it('cuenta emoji compuestos por code unit, no por caracter visual (puede rechazar antes de lo esperado visualmente)', () => {
    // Un emoji con modificador de tono de piel + ZWJ ocupa varios code
    // units UTF-16 - documenta que .length cuenta code units, no "letras".
    const emojiCompuesto = '👨‍👩‍👧‍👦' // 1 caracter visual, 11 code units
    const apodo = emojiCompuesto.repeat(3) // 33 code units
    expect(apodo.length).toBeGreaterThan(MAX_NICKNAME_LENGTH)
    expect(validateNicknameInput(apodo, REQUERIDO, MUY_LARGO)).toEqual([MUY_LARGO])
  })
})

describe('validateMessageInput', () => {
  it('un mensaje vacio se permite (no es obligatorio a este nivel)', () => {
    expect(validateMessageInput('', MUY_LARGO)).toEqual([])
  })

  it('acepta un mensaje justo en el limite', () => {
    expect(validateMessageInput('a'.repeat(MAX_MESSAGE_LENGTH), MUY_LARGO)).toEqual([])
  })

  it('rechaza un mensaje un caracter por encima del limite', () => {
    expect(validateMessageInput('a'.repeat(MAX_MESSAGE_LENGTH + 1), MUY_LARGO)).toEqual([MUY_LARGO])
  })

  it('un intento de mandar un mensaje gigante (ej. pegar un documento entero) se rechaza', () => {
    expect(validateMessageInput('a'.repeat(MAX_MESSAGE_LENGTH * 50), MUY_LARGO)).toEqual([MUY_LARGO])
  })
})

describe('validateVaultSecretInput', () => {
  it('rechaza un secreto vacio', () => {
    expect(validateVaultSecretInput('', REQUERIDO, MUY_LARGO)).toEqual([REQUERIDO])
  })

  it('rechaza un secreto de solo espacios', () => {
    expect(validateVaultSecretInput('   ', REQUERIDO, MUY_LARGO)).toEqual([REQUERIDO])
  })

  it('acepta un secreto justo en el limite', () => {
    expect(validateVaultSecretInput('a'.repeat(MAX_VAULT_SECRET_LENGTH), REQUERIDO, MUY_LARGO)).toEqual([])
  })

  it('rechaza un secreto un caracter por encima del limite', () => {
    expect(validateVaultSecretInput('a'.repeat(MAX_VAULT_SECRET_LENGTH + 1), REQUERIDO, MUY_LARGO)).toEqual([
      MUY_LARGO,
    ])
  })

  it('un secreto con contenido real (ej. una contraseña con simbolos) dentro del limite pasa', () => {
    expect(validateVaultSecretInput('P@ssw0rd!#$%^&*()_+', REQUERIDO, MUY_LARGO)).toEqual([])
  })
})
