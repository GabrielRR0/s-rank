import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RealtimeAuthError, refreshAccessToken } from '../../services/secretChat/realtimeAuth.service'
import * as canalService from '../../services/secretChat/realtime.service'
import { guardarSesion, hasValidSession, limpiarSesion } from './useRoomSession'
import { useRealtimeAuth } from './useRealtimeAuth'

vi.mock('../../services/secretChat/realtimeAuth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/secretChat/realtimeAuth.service')>()
  return { ...actual, refreshAccessToken: vi.fn() }
})
vi.mock('../../services/secretChat/realtime.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/secretChat/realtime.service')>()
  return { ...actual, setRealtimeAuth: vi.fn().mockResolvedValue(undefined) }
})

function montarRealtimeAuth(roomId: string) {
  let composable!: ReturnType<typeof useRealtimeAuth>
  mount(
    defineComponent({
      setup() {
        composable = useRealtimeAuth(roomId)
        return () => h('div')
      },
    }),
  )
  return composable
}

describe('useRealtimeAuth', () => {
  beforeEach(() => {
    vi.mocked(refreshAccessToken).mockReset()
    vi.mocked(canalService.setRealtimeAuth).mockClear()
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sin session_token guardado, pasa directo a requiere-reverificacion sin llamar a la red', async () => {
    const composable = montarRealtimeAuth('sala-sin-sesion')

    await composable.iniciar()

    expect(composable.estado.value).toBe('requiere-reverificacion')
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('con session_token valido, refresca el access_token y queda en estado listo', async () => {
    guardarSesion('sala-1', 'session-token', new Date(Date.now() + 3_600_000).toISOString())
    vi.mocked(refreshAccessToken).mockResolvedValue({
      accessToken: 'access-nuevo',
      accessExpiresAt: new Date(Date.now() + 300_000).toISOString(),
    })
    const composable = montarRealtimeAuth('sala-1')

    await composable.iniciar()

    expect(composable.estado.value).toBe('listo')
    expect(canalService.setRealtimeAuth).toHaveBeenCalledWith('access-nuevo')
  })

  it('un 401 al refrescar (session_token vencido/invalido) limpia la sesion y pide reverificacion', async () => {
    guardarSesion('sala-401', 'session-token-vencido', new Date(Date.now() + 3_600_000).toISOString())
    vi.mocked(refreshAccessToken).mockRejectedValue(new RealtimeAuthError('vencido', 401))
    const composable = montarRealtimeAuth('sala-401')

    await composable.iniciar()

    expect(composable.estado.value).toBe('requiere-reverificacion')
    expect(hasValidSession('sala-401')).toBe(false)
  })

  it('un error de red (no 401) reintenta despues sin borrar la sesion', async () => {
    guardarSesion('sala-red', 'session-token', new Date(Date.now() + 3_600_000).toISOString())
    vi.mocked(refreshAccessToken)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ accessToken: 'access-tras-reintento', accessExpiresAt: new Date(Date.now() + 300_000).toISOString() })
    const composable = montarRealtimeAuth('sala-red')

    await composable.iniciar()

    // Sigue "pendiente" (nunca llego a 'listo' en el primer intento), pero
    // la sesion sigue viva - va a reintentar solo, no hace falta Turnstile de nuevo.
    expect(composable.estado.value).toBe('pendiente')
    expect(hasValidSession('sala-red')).toBe(true)

    await vi.advanceTimersByTimeAsync(15_000) // REINTENTO_MS
    expect(composable.estado.value).toBe('listo')
    expect(refreshAccessToken).toHaveBeenCalledTimes(2)
  })

  it('agenda el proximo refresco antes de que venza el access_token (con margen) y se dispara solo', async () => {
    guardarSesion('sala-refresco', 'session-token', new Date(Date.now() + 3_600_000).toISOString())
    vi.mocked(refreshAccessToken).mockResolvedValue({
      accessToken: 'access-1',
      accessExpiresAt: new Date(Date.now() + 70_000).toISOString(), // vence en 70s
    })
    const composable = montarRealtimeAuth('sala-refresco')
    await composable.iniciar()
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)

    // MARGEN_REFRESCO_MS=60s -> el proximo refresco se agenda a los ~10s (70-60).
    await vi.advanceTimersByTimeAsync(10_000)

    expect(refreshAccessToken).toHaveBeenCalledTimes(2)
  })

  it('limpiarSesion externo (ej. otra pestaña te expulso) hace que el siguiente refresco pida reverificacion', async () => {
    guardarSesion('sala-expulsada', 'session-token', new Date(Date.now() + 3_600_000).toISOString())
    const composable = montarRealtimeAuth('sala-expulsada')
    limpiarSesion('sala-expulsada') // se limpia ANTES de que corra el primer refresco

    await composable.iniciar()

    expect(composable.estado.value).toBe('requiere-reverificacion')
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })
})
