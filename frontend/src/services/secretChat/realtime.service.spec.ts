import { describe, expect, it, vi } from 'vitest'

const canalFalso = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  track: vi.fn(),
  untrack: vi.fn(),
  send: vi.fn(),
  presenceState: vi.fn(() => ({})),
}
const clienteFalso = {
  channel: vi.fn(() => canalFalso),
  removeChannel: vi.fn(),
  realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
}

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => clienteFalso) }))

// Importado DESPUES del mock - realtime.service.ts cachea el cliente en un
// singleton de modulo, asi que todos los tests de este archivo comparten la
// misma instancia falsa (mismo criterio que el cliente real: un socket por
// pestaña, no uno por sala). Por eso cada test usa un roomId distinto.
const { getPresenceKey, getRoomChannel, removeRoomChannel, setRealtimeAuth } = await import('./realtime.service')

describe('realtime.service', () => {
  it('getRoomChannel crea un canal privado con broadcast self:false', () => {
    getRoomChannel('sala-a')

    expect(clienteFalso.channel).toHaveBeenCalledWith(
      'room:sala-a',
      expect.objectContaining({
        config: expect.objectContaining({
          broadcast: { self: false, ack: false },
          private: true,
        }),
      }),
    )
  })

  it('getRoomChannel reutiliza el mismo canal para la misma sala (no reconecta)', () => {
    const primero = getRoomChannel('sala-b')
    const segundo = getRoomChannel('sala-b')

    expect(primero).toBe(segundo)
    expect(clienteFalso.channel).toHaveBeenCalledTimes(2) // sala-a (test anterior) + sala-b, no 3
  })

  it('getPresenceKey devuelve la misma clave para llamadas repetidas de la misma sala', () => {
    getRoomChannel('sala-c')

    const clave1 = getPresenceKey('sala-c')
    const clave2 = getPresenceKey('sala-c')

    expect(clave1).not.toBeNull()
    expect(clave1).toBe(clave2)
  })

  it('salas distintas tienen presence keys distintas', () => {
    getRoomChannel('sala-d')
    getRoomChannel('sala-e')

    expect(getPresenceKey('sala-d')).not.toBe(getPresenceKey('sala-e'))
  })

  it('getPresenceKey de una sala sin canal creado devuelve null', () => {
    expect(getPresenceKey('sala-nunca-conectada')).toBeNull()
  })

  it('removeRoomChannel remueve el canal del cliente y limpia el cache local', () => {
    getRoomChannel('sala-f')

    removeRoomChannel('sala-f')

    expect(clienteFalso.removeChannel).toHaveBeenCalledWith(canalFalso)
    expect(getPresenceKey('sala-f')).toBeNull()
  })

  it('setRealtimeAuth delega en client.realtime.setAuth con el token dado', async () => {
    await setRealtimeAuth('access-token-123')

    expect(clienteFalso.realtime.setAuth).toHaveBeenCalledWith('access-token-123')
  })
})
