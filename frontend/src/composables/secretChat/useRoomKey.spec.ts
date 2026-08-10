import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { exportarClaveParaUrl, generarClaveSala } from '../../services/secretChat/crypto.service'
import { useRoomKey } from './useRoomKey'

function montarRoomKey() {
  let composable!: ReturnType<typeof useRoomKey>
  mount(
    defineComponent({
      setup() {
        composable = useRoomKey()
        return () => h('div')
      },
    }),
  )
  return composable
}

describe('useRoomKey', () => {
  afterEach(() => {
    window.location.hash = ''
  })

  it('sin fragmento en la URL, termina en error sin clave', async () => {
    window.location.hash = ''

    const composable = montarRoomKey()
    await vi.waitFor(() => expect(composable.cargando.value).toBe(false))

    expect(composable.error.value).toBe(true)
    expect(composable.clave.value).toBeNull()
  })

  it('con un fragmento valido, carga la clave sin error', async () => {
    const claveOriginal = await generarClaveSala()
    window.location.hash = `#${await exportarClaveParaUrl(claveOriginal)}`

    const composable = montarRoomKey()
    await vi.waitFor(() => expect(composable.cargando.value).toBe(false))

    expect(composable.error.value).toBe(false)
    expect(composable.clave.value).not.toBeNull()
  })

  it('un fragmento corrupto/truncado (link mal copiado por el usuario) cae en error, no crashea', async () => {
    window.location.hash = '#esto-no-es-una-clave-valida'

    const composable = montarRoomKey()
    await vi.waitFor(() => expect(composable.cargando.value).toBe(false))

    expect(composable.error.value).toBe(true)
    expect(composable.clave.value).toBeNull()
  })

  it('un fragmento con caracteres claramente invalidos para base64url tambien cae en error', async () => {
    window.location.hash = '#!!!###invalido'

    const composable = montarRoomKey()
    await vi.waitFor(() => expect(composable.cargando.value).toBe(false))

    expect(composable.error.value).toBe(true)
  })
})
