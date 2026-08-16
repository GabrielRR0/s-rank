import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocale } from '../../i18n/useLocale'
import ChatSidebar from './ChatSidebar.vue'

function dispararPointer(el: Element, tipo: string, clientX: number) {
  el.dispatchEvent(new PointerEvent(tipo, { clientX, bubbles: true }))
}

function montar(abierto = true) {
  return mount(ChatSidebar, { props: { ocupantes: [], abierto, objetivoVoto: null } })
}

describe('ChatSidebar - deslizar para cerrar', () => {
  beforeEach(() => {
    useLocale().locale.value = 'es'
  })

  it('deslizar hacia la izquierda pasado el umbral emite "cerrar"', async () => {
    const wrapper = montar()
    const el = wrapper.find('.chat-sidebar').element

    dispararPointer(el, 'pointerdown', 200)
    dispararPointer(el, 'pointermove', 100)
    dispararPointer(el, 'pointerup', 100)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
  })

  it('deslizar sin pasar el umbral no emite "cerrar"', async () => {
    const wrapper = montar()
    const el = wrapper.find('.chat-sidebar').element

    dispararPointer(el, 'pointerdown', 200)
    dispararPointer(el, 'pointermove', 170)
    dispararPointer(el, 'pointerup', 170)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cerrar')).toBeUndefined()
  })

  it('el boton "x" sigue cerrando igual, independiente del gesto', async () => {
    const wrapper = montar()

    await wrapper.find('.boton-cerrar').trigger('click')

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
  })
})

describe('ChatSidebar - compartir enlace', () => {
  beforeEach(() => {
    useLocale().locale.value = 'es'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa el share sheet nativo cuando esta disponible', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share })
    const wrapper = montar()

    await wrapper.find('.boton-compartir').trigger('click')
    await wrapper.vm.$nextTick()

    expect(share).toHaveBeenCalledOnce()
    expect(wrapper.find('.boton-compartir').text()).not.toContain('Copiado')
  })

  it('cae al portapapeles y muestra "Copiado" cuando no hay share nativo', async () => {
    const { share: _share, ...navegadorSinShare } = navigator as Navigator & { share?: unknown }
    vi.stubGlobal('navigator', { ...navegadorSinShare, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const wrapper = montar()

    await wrapper.find('.boton-compartir').trigger('click')
    // compartirEnlace() es async (navigator.share o el fallback de
    // clipboard, ambos con su propia cadena de promesas) - el trigger('click')
    // de VTU solo espera el tick de Vue, no la continuacion async del
    // handler. Hace falta ceder el hilo explicitamente antes de revisar el DOM.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.boton-compartir').text()).toContain('Copiado')
  })
})
