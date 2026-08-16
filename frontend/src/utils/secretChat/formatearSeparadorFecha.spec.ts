import { describe, expect, it } from 'vitest'
import { formatearSeparadorFecha, sonMismoDia } from './formatearSeparadorFecha'

const HOY = new Date('2026-08-15T18:00:00Z').getTime()
const AYER = new Date('2026-08-14T10:00:00Z').getTime()
const HACE_UNA_SEMANA = new Date('2026-08-08T10:00:00Z').getTime()
const AÑO_PASADO = new Date('2025-03-01T10:00:00Z').getTime()

describe('formatearSeparadorFecha', () => {
  it('devuelve "Hoy"/"Today" para el mismo dia', () => {
    expect(formatearSeparadorFecha(HOY, 'es', HOY)).toBe('Hoy')
    expect(formatearSeparadorFecha(HOY, 'en', HOY)).toBe('Today')
  })

  it('devuelve "Ayer"/"Yesterday" para el dia anterior', () => {
    expect(formatearSeparadorFecha(AYER, 'es', HOY)).toBe('Ayer')
    expect(formatearSeparadorFecha(AYER, 'en', HOY)).toBe('Yesterday')
  })

  it('devuelve dia y mes (sin año) para fechas del mismo año', () => {
    const resultado = formatearSeparadorFecha(HACE_UNA_SEMANA, 'es', HOY)
    expect(resultado).not.toMatch(/2026/)
    expect(resultado).toContain('agosto')
  })

  it('incluye el año cuando es distinto al actual', () => {
    const resultado = formatearSeparadorFecha(AÑO_PASADO, 'es', HOY)
    expect(resultado).toMatch(/2025/)
  })
})

describe('sonMismoDia', () => {
  it('es true para dos timestamps del mismo dia calendario', () => {
    expect(sonMismoDia(new Date('2026-08-15T01:00:00').getTime(), new Date('2026-08-15T23:00:00').getTime())).toBe(true)
  })

  it('es false al cruzar la medianoche', () => {
    expect(sonMismoDia(new Date('2026-08-15T23:59:00').getTime(), new Date('2026-08-16T00:01:00').getTime())).toBe(false)
  })
})
