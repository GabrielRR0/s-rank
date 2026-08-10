import { mount } from '@vue/test-utils'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createFakeRealtimeBus, type FakeChannelView } from '../../test-support/fakeRealtimeChannel'
import { generarClaveSala } from '../../services/secretChat/crypto.service'
import { useTypingIndicator } from './useTypingIndicator'

function montarTypingIndicator(vista: FakeChannelView | null, clave: CryptoKey, apodoPropio: string) {
  let composable!: ReturnType<typeof useTypingIndicator>
  mount(
    defineComponent({
      setup() {
        composable = useTypingIndicator(vista as unknown as RealtimeChannel | null, clave, apodoPropio)
        return () => h('div')
      },
    }),
  )
  return composable
}

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('notificarEscribiendo respeta el throttle: rafagas dentro de THROTTLE_MS solo emiten un broadcast', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const vistaEmisor = bus.createView('emisor')
    const sendSpy = vi.spyOn(vistaEmisor, 'send')
    const composable = montarTypingIndicator(vistaEmisor, clave, 'yo')

    await composable.notificarEscribiendo()
    await composable.notificarEscribiendo()
    await composable.notificarEscribiendo()

    expect(sendSpy).toHaveBeenCalledTimes(1)
  })

  it('pasado THROTTLE_MS, una nueva notificacion si se emite', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const vistaEmisor = bus.createView('emisor')
    const sendSpy = vi.spyOn(vistaEmisor, 'send')
    const composable = montarTypingIndicator(vistaEmisor, clave, 'yo')

    await composable.notificarEscribiendo()
    vi.advanceTimersByTime(1600) // THROTTLE_MS=1500
    await composable.notificarEscribiendo()

    expect(sendSpy).toHaveBeenCalledTimes(2)
  })

  it('un broadcast cuyo autor descifrado coincide con el propio apodo se ignora (colision de apodos entre 2 personas distintas)', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    // "a" eligio el apodo "ana"; "c" (una persona DISTINTA) tambien eligio
    // "ana" sin saberlo - los apodos no son unicos en esta app. El guard
    // `autor === apodoPropio` de useTypingIndicator no distingue ese caso
    // de un eco propio: documenta el comportamiento actual tal cual es.
    const composableA = montarTypingIndicator(bus.createView('a'), clave, 'ana')
    const composableC = montarTypingIndicator(bus.createView('c'), clave, 'ana')

    await composableC.notificarEscribiendo()
    await vi.advanceTimersByTimeAsync(0)

    expect(composableA.escribiendo.value).toEqual([])
  })

  it('un participante distinto escribiendo aparece en la lista de otro', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const composableA = montarTypingIndicator(bus.createView('a'), clave, 'ana')
    const composableB = montarTypingIndicator(bus.createView('b'), clave, 'beto')

    await composableB.notificarEscribiendo()
    await vi.waitFor(() => expect(composableA.escribiendo.value).toEqual(['beto']))
  })

  it('el indicador desaparece solo a los EXPIRACION_MS de silencio', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const composableA = montarTypingIndicator(bus.createView('a'), clave, 'ana')
    const composableB = montarTypingIndicator(bus.createView('b'), clave, 'beto')

    await composableB.notificarEscribiendo()
    await vi.waitFor(() => expect(composableA.escribiendo.value).toEqual(['beto']))

    vi.advanceTimersByTime(3000) // EXPIRACION_MS
    expect(composableA.escribiendo.value).toEqual([])
  })

  it('un payload que no se puede descifrar (clave equivocada / corrupto) se ignora sin romper nada', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const otraClave = await generarClaveSala()
    const composableA = montarTypingIndicator(bus.createView('a'), clave, 'ana')
    const composableAtacante = montarTypingIndicator(bus.createView('atacante'), otraClave, 'atacante')

    await expect(composableAtacante.notificarEscribiendo()).resolves.not.toThrow()
    await vi.advanceTimersByTimeAsync(0)

    expect(composableA.escribiendo.value).toEqual([])
  })

  it('detener() quita a alguien de la lista antes de que expire solo (ej. ya llego su mensaje)', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const composableA = montarTypingIndicator(bus.createView('a'), clave, 'ana')
    const composableB = montarTypingIndicator(bus.createView('b'), clave, 'beto')

    await composableB.notificarEscribiendo()
    await vi.waitFor(() => expect(composableA.escribiendo.value).toEqual(['beto']))

    composableA.detener('beto')

    expect(composableA.escribiendo.value).toEqual([])
  })
})
