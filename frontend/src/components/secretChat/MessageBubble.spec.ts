import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import { ahora } from '../../composables/secretChat/useTickingClock'
import { copiarAlPortapapeles } from '../../composables/useClipboard'
import MessageBubble from './MessageBubble.vue'

vi.mock('../../composables/useClipboard', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../composables/useClipboard')>()
  return { ...real, copiarAlPortapapeles: vi.fn().mockResolvedValue(true) }
})

function mensajeTexto(overrides: Partial<MensajeChat> = {}): MensajeChat {
  return { id: 'm1', autor: 'Ana', propio: false, enviadoEn: Date.now(), tipo: 'texto', texto: 'hola', ...overrides }
}

// wrapper.trigger() no sirve aca: crea el evento via document.createEvent y
// despues intenta asignarle clientX, que en PointerEvent/MouseEvent es un
// getter de solo lectura en este jsdom - falla en runtime. Se despacha un
// PointerEvent real, con clientX ya fijado en el constructor.
function dispararPointer(el: Element, tipo: string, clientX: number) {
  el.dispatchEvent(new PointerEvent(tipo, { clientX, bubbles: true }))
}

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ahora.value = Date.now()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('la cuenta regresiva sigue el reloj compartido (useTickingClock), no un timer propio', async () => {
    const enviadoEn = Date.now()
    const wrapper = mount(MessageBubble, { props: { mensaje: mensajeTexto({ enviadoEn }), ttlSegundos: 60 } })

    expect(wrapper.find('.cuenta-regresiva').text()).toBe('60s')

    ahora.value = enviadoEn + 5000
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.cuenta-regresiva').text()).toBe('55s')
  })

  it('muestra las reacciones recibidas por props y emite reaccionar al tocar una', async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        mensaje: mensajeTexto(),
        ttlSegundos: 60,
        reacciones: [{ emoji: '👍', cantidad: 2, propia: false }],
      },
    })

    const pill = wrapper.find('.pill-reaccion')
    expect(pill.text()).toContain('👍')
    expect(pill.text()).toContain('2')

    await pill.trigger('click')

    expect(wrapper.emitted('reaccionar')).toEqual([['m1', '👍']])
  })

  it('sin reacciones, no se renderiza la fila de pills', () => {
    const wrapper = mount(MessageBubble, { props: { mensaje: mensajeTexto(), ttlSegundos: 60 } })

    expect(wrapper.find('.pill-reaccion').exists()).toBe(false)
  })

  it('el tick de "visto" solo se muestra en mensajes propios ya vistos', () => {
    const propioNoVisto = mount(MessageBubble, {
      props: { mensaje: mensajeTexto({ propio: true }), ttlSegundos: 60, visto: false },
    })
    expect(propioNoVisto.find('.icono-visto').exists()).toBe(false)

    const propioVisto = mount(MessageBubble, {
      props: { mensaje: mensajeTexto({ propio: true }), ttlSegundos: 60, visto: true },
    })
    expect(propioVisto.find('.icono-visto').exists()).toBe(true)

    const ajenoVisto = mount(MessageBubble, {
      props: { mensaje: mensajeTexto({ propio: false }), ttlSegundos: 60, visto: true },
    })
    expect(ajenoVisto.find('.icono-visto').exists()).toBe(false)
  })

  it('muestra la cita del mensaje respondido cuando viene en respuestaA', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        mensaje: mensajeTexto({ respuestaA: { mensajeId: 'm0', autor: 'Beto', extracto: 'texto original' } }),
        ttlSegundos: 60,
      },
    })

    expect(wrapper.find('.respuesta-cita-autor').text()).toBe('Beto')
    expect(wrapper.find('.respuesta-cita-extracto').text()).toBe('texto original')
  })

  it('mantener presionado abre el menu de acciones', async () => {
    const wrapper = mount(MessageBubble, { props: { mensaje: mensajeTexto(), ttlSegundos: 60 }, attachTo: document.body })

    dispararPointer(wrapper.find('.message-bubble').element, 'pointerdown', 10)
    vi.advanceTimersByTime(450)
    await wrapper.vm.$nextTick()

    // El menu (emojis + acciones) se Teleporta a <body> - ver MessageActionBar.vue.
    expect(document.querySelector('.message-action-bar')).not.toBeNull()
    wrapper.unmount()
  })

  it('el boton "..." tambien abre el menu (equivalente de escritorio al long-press)', async () => {
    const wrapper = mount(MessageBubble, { props: { mensaje: mensajeTexto(), ttlSegundos: 60 }, attachTo: document.body })

    await wrapper.find('.boton-mas').trigger('click')

    expect(document.querySelector('.message-action-bar')).not.toBeNull()
    wrapper.unmount()
  })

  it('"Copiar" desde el menu copia el texto del mensaje al portapapeles', async () => {
    const wrapper = mount(MessageBubble, {
      props: { mensaje: mensajeTexto({ texto: 'copiame' }), ttlSegundos: 60 },
      attachTo: document.body,
    })
    dispararPointer(wrapper.find('.message-bubble').element, 'pointerdown', 10)
    vi.advanceTimersByTime(450)
    await wrapper.vm.$nextTick()

    document.querySelectorAll('.boton-accion')[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(copiarAlPortapapeles).toHaveBeenCalledWith('copiame')
    wrapper.unmount()
  })

  it('el click sintetico que sigue al long-press no cierra el menu antes de poder usarlo (regresion)', async () => {
    const wrapper = mount(MessageBubble, {
      props: { mensaje: mensajeTexto({ texto: 'copiame' }), ttlSegundos: 60 },
      attachTo: document.body,
    })
    const bubble = wrapper.find('.message-bubble').element

    dispararPointer(bubble, 'pointerdown', 10)
    vi.advanceTimersByTime(450)
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.message-action-bar')).not.toBeNull()

    // El navegador real sintetiza este click al soltar el dedo/mouse -
    // MessageActionBar.vue ya no depende de un listener de "click afuera"
    // en document (cierra por click en el fondo oscurecido o Escape, ver
    // ese archivo), asi que este click sintetico no deberia afectar nada.
    bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.message-action-bar')).not.toBeNull()

    document.querySelectorAll('.boton-accion')[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(copiarAlPortapapeles).toHaveBeenCalledWith('copiame')

    wrapper.unmount()
  })

  it('deslizar hacia la derecha pasado el umbral emite "responder"', async () => {
    const wrapper = mount(MessageBubble, { props: { mensaje: mensajeTexto(), ttlSegundos: 60 } })
    const bubble = wrapper.find('.message-bubble').element

    dispararPointer(bubble, 'pointerdown', 100)
    dispararPointer(bubble, 'pointermove', 200)
    dispararPointer(bubble, 'pointerup', 200)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('responder')).toHaveLength(1)
  })

  it('deslizar un mensaje de media no emite "responder" (limitado a texto)', async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        mensaje: { id: 'm2', autor: 'Ana', propio: false, enviadoEn: Date.now(), tipo: 'media', mimeType: 'audio/webm' },
        ttlSegundos: 60,
      },
    })
    const bubble = wrapper.find('.message-bubble').element

    dispararPointer(bubble, 'pointerdown', 100)
    dispararPointer(bubble, 'pointermove', 200)
    dispararPointer(bubble, 'pointerup', 200)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('responder')).toBeUndefined()
  })
})
