import { describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES, validateFileInput, validateTextInput } from './validateShareInput'

describe('validateTextInput', () => {
  it('devuelve un error si el texto esta vacio o son solo espacios', () => {
    expect(validateTextInput('', 'requerido')).toEqual(['requerido'])
    expect(validateTextInput('   ', 'requerido')).toEqual(['requerido'])
  })

  it('no devuelve error si hay texto', () => {
    expect(validateTextInput('hola', 'requerido')).toEqual([])
  })
})

describe('validateFileInput', () => {
  it('devuelve un error si no hay archivo', () => {
    expect(validateFileInput(null, 'requerido', 'muy grande')).toEqual(['requerido'])
  })

  it('devuelve un error si el archivo supera el limite', () => {
    const archivo = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'grande.bin')

    expect(validateFileInput(archivo, 'requerido', 'muy grande')).toEqual(['muy grande'])
  })

  it('no devuelve error si el archivo esta dentro del limite', () => {
    const archivo = new File([new Uint8Array(100)], 'chico.bin')

    expect(validateFileInput(archivo, 'requerido', 'muy grande')).toEqual([])
  })
})
