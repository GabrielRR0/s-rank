import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AudioPlayer from './AudioPlayer.vue'

// jsdom no implementa la Web Audio API - se mockea un AudioContext minimo
// (lo justo para que useAudioPlayer.ts pueda decodificar y "reproducir" sin
// una libreria de audio real detras). No pretende fidelidad de audio real,
// solo cubrir el estado de reproducir/pausar y que la posicion avanza.
const DURACION_FALSA = 10

class NodoFalso {
  buffer: unknown = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

let ultimaInstancia: FakeAudioContext | undefined

class FakeAudioContext {
  currentTime = 0
  state: 'suspended' | 'running' = 'running'
  destination = {}
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  decodeAudioData = vi.fn(async () => ({ duration: DURACION_FALSA }) as AudioBuffer)
  createBufferSource = vi.fn(() => new NodoFalso() as unknown as AudioBufferSourceNode)

  constructor() {
    ultimaInstancia = this
  }
}

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext
    // El AudioContext lo cachea audioContext.service.ts como singleton de
    // modulo - la MISMA instancia (y sus mocks) se comparte entre tests de
    // este archivo, asi que hay que limpiar el historial de llamadas entre
    // uno y otro para no arrastrar resultados de un test anterior.
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra la duracion una vez decodificado el audio', async () => {
    const wrapper = mount(AudioPlayer, { props: { datos: new ArrayBuffer(8) } })
    await flushPromises()

    expect(wrapper.text()).toContain('0:10')
  })

  it('nunca renderiza un elemento <audio> nativo (sin src descargable)', async () => {
    const wrapper = mount(AudioPlayer, { props: { datos: new ArrayBuffer(8) } })
    await flushPromises()

    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('tocar play arranca la reproduccion sobre un AudioBufferSourceNode', async () => {
    const wrapper = mount(AudioPlayer, { props: { datos: new ArrayBuffer(8) } })
    await flushPromises()
    const labelInicial = wrapper.find('.boton-play').attributes('aria-label')

    await wrapper.find('.boton-play').trigger('click')
    await flushPromises()

    expect(ultimaInstancia?.createBufferSource).toHaveBeenCalledTimes(1)
    // No se hardcodea el string traducido (depende del idioma detectado en
    // el entorno de test) - lo que importa es que cambia entre reproducir/pausar.
    expect(wrapper.find('.boton-play').attributes('aria-label')).not.toBe(labelInicial)
  })

  it('tocar pausa detiene el nodo activo', async () => {
    const wrapper = mount(AudioPlayer, { props: { datos: new ArrayBuffer(8) } })
    await flushPromises()

    await wrapper.find('.boton-play').trigger('click')
    await flushPromises()
    const labelReproduciendo = wrapper.find('.boton-play').attributes('aria-label')
    const nodo = ultimaInstancia?.createBufferSource.mock.results.at(-1)?.value as NodoFalso

    await wrapper.find('.boton-play').trigger('click')
    await flushPromises()

    expect(nodo.stop).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.boton-play').attributes('aria-label')).not.toBe(labelReproduciendo)
  })

  it('la posicion avanza mientras reproduce', async () => {
    const wrapper = mount(AudioPlayer, { props: { datos: new ArrayBuffer(8) } })
    await flushPromises()

    await wrapper.find('.boton-play').trigger('click')
    await flushPromises()

    if (ultimaInstancia) ultimaInstancia.currentTime = 3
    vi.advanceTimersByTime(50)
    await flushPromises()

    expect(wrapper.text()).toContain('0:03')
  })
})
