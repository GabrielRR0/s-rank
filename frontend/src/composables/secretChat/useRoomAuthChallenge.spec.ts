import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { fetchInitialTokens, RealtimeAuthError } from '../../services/secretChat/realtimeAuth.service'
import { hasValidSession } from './useRoomSession'
import { useRoomAuthChallenge } from './useRoomAuthChallenge'

vi.mock('../../services/secretChat/realtimeAuth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/secretChat/realtimeAuth.service')>()
  return { ...actual, fetchInitialTokens: vi.fn() }
})

function montarRoomAuthChallenge(roomId: string) {
  let composable!: ReturnType<typeof useRoomAuthChallenge>
  mount(
    defineComponent({
      setup() {
        composable = useRoomAuthChallenge(roomId)
        return () => h('div')
      },
    }),
  )
  return composable
}

describe('useRoomAuthChallenge', () => {
  beforeEach(() => {
    vi.mocked(fetchInitialTokens).mockReset()
    sessionStorage.clear()
    // Los mensajes esperados abajo estan en español - fijar el locale
    // explicito evita que el test dependa de navigator.language del
    // entorno donde corre (jsdom por defecto detecta "en").
    useLocale().locale.value = 'es'
  })

  it('exito: guarda la sesion y verificar() resuelve true', async () => {
    vi.mocked(fetchInitialTokens).mockResolvedValue({
      accessToken: 'a',
      accessExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      sessionToken: 'session-token-valido',
      sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
    const composable = montarRoomAuthChallenge('sala-1')

    const resultado = await composable.verificar()

    expect(resultado).toBe(true)
    expect(composable.error.value).toBe('')
    expect(hasValidSession('sala-1')).toBe(true)
  })

  it('401 (contraseña incorrecta) muestra el mensaje correspondiente y no guarda sesion', async () => {
    vi.mocked(fetchInitialTokens).mockRejectedValue(new RealtimeAuthError('Contraseña incorrecta.', 401))
    const composable = montarRoomAuthChallenge('sala-2')

    const resultado = await composable.verificar()

    expect(resultado).toBe(false)
    expect(composable.error.value).toBe('Contraseña incorrecta.')
    expect(hasValidSession('sala-2')).toBe(false)
  })

  it('410 (sala vencida) muestra el mensaje correspondiente', async () => {
    vi.mocked(fetchInitialTokens).mockRejectedValue(new RealtimeAuthError('vencida', 410))
    const composable = montarRoomAuthChallenge('sala-3')

    await composable.verificar()

    expect(composable.error.value).toBe('Esta sala ya no está disponible.')
  })

  it('429 (demasiados intentos / bloqueado por bot_guard) muestra el mensaje correspondiente', async () => {
    vi.mocked(fetchInitialTokens).mockRejectedValue(new RealtimeAuthError('bloqueado', 429))
    const composable = montarRoomAuthChallenge('sala-4')

    await composable.verificar()

    expect(composable.error.value).toBe('Demasiados intentos. Vuelve a intentarlo más tarde.')
  })

  it('un error inesperado (red caida, 500, etc.) cae en el mensaje generico', async () => {
    vi.mocked(fetchInitialTokens).mockRejectedValue(new TypeError('Failed to fetch'))
    const composable = montarRoomAuthChallenge('sala-5')

    const resultado = await composable.verificar()

    expect(resultado).toBe(false)
    expect(composable.error.value).toBe('No se pudo verificar. Vuelve a intentarlo.')
  })

  it('el flag enviando esta activo durante la llamada y se apaga al terminar (exito o error)', async () => {
    let resolver!: (value: Awaited<ReturnType<typeof fetchInitialTokens>>) => void
    vi.mocked(fetchInitialTokens).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      }),
    )
    const composable = montarRoomAuthChallenge('sala-6')

    expect(composable.enviando.value).toBe(false)
    const promesaVerificar = composable.verificar()
    expect(composable.enviando.value).toBe(true)

    resolver({
      accessToken: 'a',
      accessExpiresAt: new Date().toISOString(),
      sessionToken: 's',
      sessionExpiresAt: new Date(Date.now() + 1000).toISOString(),
    })
    await promesaVerificar

    expect(composable.enviando.value).toBe(false)
  })

  it('limpia el error anterior al reintentar verificar()', async () => {
    vi.mocked(fetchInitialTokens).mockRejectedValueOnce(new RealtimeAuthError('Contraseña incorrecta.', 401))
    const composable = montarRoomAuthChallenge('sala-7')
    await composable.verificar()
    expect(composable.error.value).not.toBe('')

    vi.mocked(fetchInitialTokens).mockResolvedValueOnce({
      accessToken: 'a',
      accessExpiresAt: new Date().toISOString(),
      sessionToken: 's',
      sessionExpiresAt: new Date(Date.now() + 1000).toISOString(),
    })
    await composable.verificar()

    expect(composable.error.value).toBe('')
  })
})
