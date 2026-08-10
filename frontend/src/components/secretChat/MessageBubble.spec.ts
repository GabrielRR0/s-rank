import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import MessageBubble from './MessageBubble.vue'

function mensajeImagen(overrides: Partial<MensajeChat> = {}): MensajeChat {
  return {
    id: 'm1',
    autor: 'Ana',
    propio: false,
    enviadoEn: Date.now(),
    tipo: 'media',
    mediaUrl: 'blob:fake-imagen',
    mimeType: 'image/png',
    ...overrides,
  }
}

// ConfirmModal.vue usa <Teleport to="body"> - su contenido vive fuera del
// arbol del wrapper, hay que buscarlo en document.body directamente.
function modalDeConfirmacion(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]')
}

describe('MessageBubble - imagen oculta de un solo vistazo', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
  })

  it('una imagen nueva se muestra oculta, nunca la imagen real de entrada', () => {
    wrapper = mount(MessageBubble, { props: { mensaje: mensajeImagen(), ttlSegundos: 60 } })

    expect(wrapper.find('.media-oculta').exists()).toBe(true)
    expect(wrapper.find('.media-ya-vista').exists()).toBe(false)
    expect(wrapper.find('img.media-imagen').exists()).toBe(false)
    expect(modalDeConfirmacion()).toBeNull()
  })

  it('tocar la caja oculta pide confirmacion antes de revelar nada', async () => {
    wrapper = mount(MessageBubble, { props: { mensaje: mensajeImagen(), ttlSegundos: 60 } })

    await wrapper.find('.media-oculta').trigger('click')
    await flushPromises()

    expect(modalDeConfirmacion()).not.toBeNull()
    expect(wrapper.find('img.media-imagen').exists()).toBe(false)
  })

  it('cancelar la confirmacion cierra el modal sin revelar la imagen', async () => {
    wrapper = mount(MessageBubble, { props: { mensaje: mensajeImagen(), ttlSegundos: 60 } })

    await wrapper.find('.media-oculta').trigger('click')
    await flushPromises()
    modalDeConfirmacion()?.querySelector<HTMLButtonElement>('.boton-cancelar')?.click()
    await flushPromises()

    expect(modalDeConfirmacion()).toBeNull()
    expect(wrapper.find('img.media-imagen').exists()).toBe(false)
    expect(wrapper.find('.media-oculta').exists()).toBe(true)
  })

  it('aceptar la confirmacion revela la imagen real', async () => {
    wrapper = mount(MessageBubble, { props: { mensaje: mensajeImagen(), ttlSegundos: 60 } })

    await wrapper.find('.media-oculta').trigger('click')
    await flushPromises()
    modalDeConfirmacion()?.querySelector<HTMLButtonElement>('.boton-aceptar')?.click()
    await flushPromises()

    expect(modalDeConfirmacion()).toBeNull()
    expect(wrapper.find('img.media-imagen').exists()).toBe(true)
    expect(wrapper.find('img.media-imagen').attributes('src')).toBe('blob:fake-imagen')
  })

  it('a los 5 segundos se vuelve a ocultar sola, marcada como ya vista, y revoca el Blob URL', async () => {
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    wrapper = mount(MessageBubble, { props: { mensaje: mensajeImagen(), ttlSegundos: 60 } })

    await wrapper.find('.media-oculta').trigger('click')
    await flushPromises()
    modalDeConfirmacion()?.querySelector<HTMLButtonElement>('.boton-aceptar')?.click()
    await flushPromises()
    expect(wrapper.find('img.media-imagen').exists()).toBe(true)

    vi.advanceTimersByTime(5000)
    await flushPromises()

    expect(wrapper.find('img.media-imagen').exists()).toBe(false)
    expect(wrapper.find('.media-ya-vista').exists()).toBe(true)
    // Se revoca al ocultarse sola, no recien cuando el mensaje entero se
    // autodestruye - asi forzar `revelada` de nuevo desde fuera (Vue
    // Devtools) ya no puede volver a cargar la imagen real.
    expect(revocar).toHaveBeenCalledWith('blob:fake-imagen')
    revocar.mockRestore()
  })

  it('una vez vista, un segundo toque no vuelve a pedir confirmacion ni revelarla (bloqueo permanente)', async () => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    wrapper = mount(MessageBubble, { props: { mensaje: mensajeImagen(), ttlSegundos: 60 } })

    await wrapper.find('.media-oculta').trigger('click')
    await flushPromises()
    modalDeConfirmacion()?.querySelector<HTMLButtonElement>('.boton-aceptar')?.click()
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(wrapper.find('.media-ya-vista').exists()).toBe(true)

    await wrapper.find('.media-ya-vista').trigger('click')
    await flushPromises()

    expect(modalDeConfirmacion()).toBeNull()
    expect(wrapper.find('img.media-imagen').exists()).toBe(false)
    expect(wrapper.find('.media-ya-vista').exists()).toBe(true)
  })
})

describe('MessageBubble - mensajes de texto', () => {
  it('renderiza el texto sin ninguna mecanica de imagen/audio', () => {
    const mensaje: MensajeChat = {
      id: 'm2',
      autor: 'Ana',
      propio: true,
      enviadoEn: Date.now(),
      tipo: 'texto',
      texto: 'hola',
    }
    const wrapper = mount(MessageBubble, { props: { mensaje, ttlSegundos: 60 } })

    expect(wrapper.find('.texto').text()).toBe('hola')
    expect(wrapper.find('.media-oculta').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    wrapper.unmount()
  })
})
