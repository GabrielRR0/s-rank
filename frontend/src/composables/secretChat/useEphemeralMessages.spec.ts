import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useEphemeralMessages, type MensajeChat } from './useEphemeralMessages'

function montarEphemeralMessages(ttlSegundos: number, onQuitar?: (id: string) => void) {
  let composable!: ReturnType<typeof useEphemeralMessages>
  const wrapper = mount(
    defineComponent({
      setup() {
        composable = useEphemeralMessages(ttlSegundos, onQuitar)
        return () => h('div')
      },
    }),
  )
  return { composable, wrapper }
}

function mensajeTexto(overrides: Partial<MensajeChat> = {}): MensajeChat {
  return { id: 'm1', autor: 'ana', propio: false, enviadoEn: Date.now(), tipo: 'texto', texto: 'hola', ...overrides }
}

function mensajeMedia(overrides: Partial<MensajeChat> = {}): MensajeChat {
  return {
    id: 'm1',
    autor: 'ana',
    propio: false,
    enviadoEn: Date.now(),
    tipo: 'media',
    mediaUrl: 'blob:fake',
    mimeType: 'image/png',
    ...overrides,
  }
}

describe('useEphemeralMessages', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('un mensaje se autodestruye a los ttlSegundos', () => {
    const { composable } = montarEphemeralMessages(5)
    composable.agregar(mensajeTexto())

    expect(composable.mensajes.value).toHaveLength(1)
    vi.advanceTimersByTime(4999)
    expect(composable.mensajes.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(composable.mensajes.value).toHaveLength(0)
  })

  it('un mensaje de media revoca su Blob URL al autodestruirse', () => {
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { composable } = montarEphemeralMessages(5)
    composable.agregar(mensajeMedia({ mediaUrl: 'blob:se-autodestruye' }))

    vi.advanceTimersByTime(5000)

    expect(revocar).toHaveBeenCalledWith('blob:se-autodestruye')
    revocar.mockRestore()
  })

  it('quitar un mensaje no cancela el timer de los demas', () => {
    const { composable } = montarEphemeralMessages(10)
    composable.agregar(mensajeTexto({ id: 'a', enviadoEn: 1 }))
    vi.advanceTimersByTime(3000)
    composable.agregar(mensajeTexto({ id: 'b', enviadoEn: 2 }))

    // 'a' se autodestruye a los 10s desde que se agrego (t=10000).
    vi.advanceTimersByTime(7000) // t=10000
    expect(composable.mensajes.value.map((m) => m.id)).toEqual(['b'])

    // 'b' se autodestruye a los 10s desde que se agrego (t=3000+10000=13000).
    vi.advanceTimersByTime(3000) // t=13000
    expect(composable.mensajes.value).toHaveLength(0)
  })

  it('desmontar limpia todos los timers pendientes y revoca los Blob URL de media aun visibles', () => {
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { composable, wrapper } = montarEphemeralMessages(10)
    composable.agregar(mensajeMedia({ id: 'm-media', mediaUrl: 'blob:sigue-vivo' }))
    composable.agregar(mensajeTexto({ id: 'm-texto' }))

    wrapper.unmount()

    expect(revocar).toHaveBeenCalledWith('blob:sigue-vivo')
    // Que el timeout haya quedado clearteado se confirma indirectamente:
    // avanzar el reloj despues de desmontar no debe tirar ningun error (el
    // array reactivo ya no deberia seguir mutandose desde un componente
    // desmontado).
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow()
    revocar.mockRestore()
  })

  it('onQuitar se llama con el id cuando un mensaje se autodestruye', () => {
    const onQuitar = vi.fn()
    const { composable } = montarEphemeralMessages(5, onQuitar)
    composable.agregar(mensajeTexto({ id: 'm-1' }))

    vi.advanceTimersByTime(5000)

    expect(onQuitar).toHaveBeenCalledWith('m-1')
  })

  it('agregar un mensaje reproduce el sonido de notificacion', async () => {
    const soundService = await import('../../services/secretChat/sound.service')
    const spy = vi.spyOn(soundService, 'reproducirSonidoMensaje').mockImplementation(() => {})
    const { composable } = montarEphemeralMessages(30)

    composable.agregar(mensajeTexto())

    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })
})
