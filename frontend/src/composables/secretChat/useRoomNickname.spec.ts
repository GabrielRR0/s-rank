import { beforeEach, describe, expect, it } from 'vitest'
import { apodoActual, recordarApodoActual, useRoomNickname } from './useRoomNickname'

describe('useRoomNickname', () => {
  beforeEach(() => {
    sessionStorage.clear()
    apodoActual.value = ''
  })

  it('empieza vacio para una sala sin apodo guardado', () => {
    const { apodo } = useRoomNickname('sala-nueva')
    expect(apodo.value).toBe('')
  })

  it('guardar() persiste el apodo para esa sala especifica', () => {
    const { apodo, guardar } = useRoomNickname('sala-1')
    guardar('Ana')

    expect(apodo.value).toBe('Ana')
    const { apodo: apodoRelectura } = useRoomNickname('sala-1')
    expect(apodoRelectura.value).toBe('Ana')
  })

  it('el apodo de una sala no se filtra a otra sala distinta', () => {
    const { guardar: guardarA } = useRoomNickname('sala-a')
    guardarA('Ana')

    const { apodo: apodoB } = useRoomNickname('sala-b')
    expect(apodoB.value).toBe('')
  })

  it('guardar() actualiza tambien el singleton apodoActual (usado por el avatar del header)', () => {
    useRoomNickname('sala-x').guardar('Beto')

    expect(apodoActual.value).toBe('Beto')
  })

  it('recordarApodoActual persiste directamente el singleton, independiente de cualquier sala', () => {
    recordarApodoActual('Carla')

    expect(apodoActual.value).toBe('Carla')
    expect(sessionStorage.getItem('s-rank-chat:apodo-actual')).toBe('Carla')
  })
})
