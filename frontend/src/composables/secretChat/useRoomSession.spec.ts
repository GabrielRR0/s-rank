import { beforeEach, describe, expect, it } from 'vitest'
import {
  fueExpulsado,
  guardarSesion,
  hasValidSession,
  limpiarSesion,
  marcarExpulsado,
  obtenerSessionToken,
  SESSION_STORAGE_KEY_PREFIX,
} from './useRoomSession'

describe('useRoomSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('guardarSesion + obtenerSessionToken hacen roundtrip mientras la sesion sigue vigente', () => {
    guardarSesion('sala-1', 'token-abc', new Date(Date.now() + 60_000).toISOString())

    expect(hasValidSession('sala-1')).toBe(true)
    expect(obtenerSessionToken('sala-1')).toBe('token-abc')
  })

  it('sin sesion guardada, no hay sesion valida', () => {
    expect(hasValidSession('sala-inexistente')).toBe(false)
    expect(obtenerSessionToken('sala-inexistente')).toBeNull()
  })

  it('una sesion vencida no es valida, aunque el token siga en sessionStorage', () => {
    guardarSesion('sala-vencida', 'token-viejo', new Date(Date.now() - 1000).toISOString())

    expect(hasValidSession('sala-vencida')).toBe(false)
    expect(obtenerSessionToken('sala-vencida')).toBeNull()
  })

  it('JSON corrupto en sessionStorage (ej. editado a mano en devtools) no crashea, solo cuenta como sesion invalida', () => {
    sessionStorage.setItem(`${SESSION_STORAGE_KEY_PREFIX}sala-corrupta`, '{esto no es json valido')

    expect(() => hasValidSession('sala-corrupta')).not.toThrow()
    expect(hasValidSession('sala-corrupta')).toBe(false)
  })

  it('un objeto JSON valido pero con forma incorrecta (sin sessionExpiresAt) tambien cuenta como invalido', () => {
    sessionStorage.setItem(`${SESSION_STORAGE_KEY_PREFIX}sala-rara`, JSON.stringify({ sessionToken: 'x' }))

    expect(hasValidSession('sala-rara')).toBe(false)
  })

  it('las sesiones de distintas salas estan aisladas entre si', () => {
    guardarSesion('sala-a', 'token-a', new Date(Date.now() + 60_000).toISOString())
    guardarSesion('sala-b', 'token-b', new Date(Date.now() + 60_000).toISOString())

    expect(obtenerSessionToken('sala-a')).toBe('token-a')
    expect(obtenerSessionToken('sala-b')).toBe('token-b')

    limpiarSesion('sala-a')

    expect(hasValidSession('sala-a')).toBe(false)
    expect(hasValidSession('sala-b')).toBe(true) // no se contamina con la limpieza de la otra sala
  })

  it('marcarExpulsado persiste incluso despues de limpiar la sesion (evita reingreso ni con refresh)', () => {
    guardarSesion('sala-expulsion', 'token', new Date(Date.now() + 60_000).toISOString())

    marcarExpulsado('sala-expulsion')
    limpiarSesion('sala-expulsion')

    expect(hasValidSession('sala-expulsion')).toBe(false)
    expect(fueExpulsado('sala-expulsion')).toBe(true)
  })

  it('fueExpulsado es false por defecto para una sala que nunca expulso a nadie', () => {
    expect(fueExpulsado('sala-tranquila')).toBe(false)
  })
})
