import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import {
  createRoomWithPassword,
  fetchInitialTokens,
  RealtimeAuthError,
} from '../../services/secretChat/realtimeAuth.service'
import { hasValidSession } from './useRoomSession'
import { useCreateChat } from './useCreateChat'

vi.mock('../../services/secretChat/realtimeAuth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/secretChat/realtimeAuth.service')>()
  return { ...actual, fetchInitialTokens: vi.fn(), createRoomWithPassword: vi.fn() }
})

function montarCreateChat() {
  let composable!: ReturnType<typeof useCreateChat>
  mount(
    defineComponent({
      setup() {
        composable = useCreateChat()
        return () => h('div')
      },
    }),
  )
  return composable
}

const TOKENS_OK = {
  accessToken: 'a',
  accessExpiresAt: new Date(Date.now() + 300_000).toISOString(),
  sessionToken: 'session-token',
  sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
}

describe('useCreateChat', () => {
  beforeEach(() => {
    vi.mocked(fetchInitialTokens).mockReset()
    vi.mocked(createRoomWithPassword).mockReset()
    sessionStorage.clear()
    useLocale().locale.value = 'es'
  })

  it('la validacion bloquea el submit con apodo vacio, sin pegarle a la red', async () => {
    const composable = montarCreateChat()
    composable.apodo.value = ''

    await composable.crear()

    expect(fetchInitialTokens).not.toHaveBeenCalled()
    expect(composable.errores.value.length).toBeGreaterThan(0)
    expect(composable.resultado.value).toBeNull()
  })

  it('con proteccion por password activada pero password vacia, bloquea el submit', async () => {
    const composable = montarCreateChat()
    composable.apodo.value = 'Ana'
    composable.protegerConPassword.value = true
    composable.password.value = ''

    await composable.crear()

    expect(fetchInitialTokens).not.toHaveBeenCalled()
    expect(createRoomWithPassword).not.toHaveBeenCalled()
    expect(composable.errores.value.length).toBeGreaterThan(0)
  })

  it('camino feliz sin password: arma el link con la clave en el fragmento y los query params correctos', async () => {
    vi.mocked(fetchInitialTokens).mockResolvedValue(TOKENS_OK)
    const composable = montarCreateChat()
    composable.apodo.value = 'Ana'
    composable.capacidadMaxima.value = 4
    composable.ttlSegundos.value = 15

    await composable.crear()

    expect(createRoomWithPassword).not.toHaveBeenCalled()
    expect(fetchInitialTokens).toHaveBeenCalledOnce()
    expect(composable.resultado.value).not.toBeNull()
    const enlace = new URL(composable.resultado.value!.enlace)
    expect(enlace.searchParams.get('cap')).toBe('4')
    expect(enlace.searchParams.get('ttl')).toBe('15')
    expect(enlace.searchParams.has('pwd')).toBe(false)
    expect(enlace.hash).not.toBe('') // la clave de cifrado viaja en el fragmento
    expect(hasValidSession(composable.resultado.value!.roomId)).toBe(true)
  })

  it('camino feliz con password: llama a createRoomWithPassword, no a fetchInitialTokens, y marca pwd=1 en el link', async () => {
    vi.mocked(createRoomWithPassword).mockResolvedValue(TOKENS_OK)
    const composable = montarCreateChat()
    composable.apodo.value = 'Ana'
    composable.protegerConPassword.value = true
    composable.password.value = 'correcta123'

    await composable.crear()

    expect(createRoomWithPassword).toHaveBeenCalledOnce()
    expect(fetchInitialTokens).not.toHaveBeenCalled()
    const enlace = new URL(composable.resultado.value!.enlace)
    expect(enlace.searchParams.get('pwd')).toBe('1')
  })

  it('cada sala creada tiene una clave de cifrado distinta (no se reutiliza entre salas)', async () => {
    vi.mocked(fetchInitialTokens).mockResolvedValue(TOKENS_OK)
    const composableA = montarCreateChat()
    composableA.apodo.value = 'Ana'
    await composableA.crear()

    const composableB = montarCreateChat()
    composableB.apodo.value = 'Beto'
    await composableB.crear()

    const claveA = new URL(composableA.resultado.value!.enlace).hash
    const claveB = new URL(composableB.resultado.value!.enlace).hash
    expect(claveA).not.toBe(claveB)
  })

  it('un error de la API (ej. rate limit, Turnstile fallido) se muestra en errorCreacion sin crashear', async () => {
    // Separado de `errores` (validacion local, sin red) a proposito - el
    // consumidor (CreateChatMain.vue) necesita distinguir "fallo la
    // validacion" de "el intento de red fallo" para saber si hace falta
    // pedirle un token nuevo a Turnstile.
    vi.mocked(fetchInitialTokens).mockRejectedValue(new RealtimeAuthError('Verificación anti-bot fallida.', 422))
    const composable = montarCreateChat()
    composable.apodo.value = 'Ana'

    await composable.crear()

    expect(composable.errorCreacion.value).toBe('Verificación anti-bot fallida.')
    expect(composable.errores.value).toEqual([])
    expect(composable.resultado.value).toBeNull()
  })

  it('reiniciar() limpia todos los campos a sus valores por defecto', async () => {
    vi.mocked(fetchInitialTokens).mockResolvedValue(TOKENS_OK)
    const composable = montarCreateChat()
    composable.apodo.value = 'Ana'
    await composable.crear()
    expect(composable.resultado.value).not.toBeNull()

    composable.protegerConPassword.value = true
    composable.password.value = 'algo'

    composable.reiniciar()

    expect(composable.apodo.value).toBe('')
    expect(composable.protegerConPassword.value).toBe(false)
    expect(composable.password.value).toBe('')
    expect(composable.resultado.value).toBeNull()
    expect(composable.capacidadMaxima.value).toBe(4)
    expect(composable.ttlSegundos.value).toBe(15)
  })
})
