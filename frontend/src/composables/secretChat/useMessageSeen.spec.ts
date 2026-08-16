import { mount } from '@vue/test-utils'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createFakeRealtimeBus, type FakeChannelView } from '../../test-support/fakeRealtimeChannel'
import { useMessageSeen } from './useMessageSeen'

function montarMessageSeen(vista: FakeChannelView | null, miClavePresencia: string | null) {
  let composable!: ReturnType<typeof useMessageSeen>
  mount(
    defineComponent({
      setup() {
        composable = useMessageSeen(vista as unknown as RealtimeChannel | null, miClavePresencia)
        return () => h('div')
      },
    }),
  )
  return composable
}

// jsdom no simula focus real - document.hasFocus() da false por defecto,
// lo que useMessageSeen.ts interpreta como "pestaña inactiva" (correcto:
// asi tambien se comporta un test-runner sin ventana real enfocada). Estos
// tests simulan "pestaña activa" explicitamente salvo los que prueban
// justamente el caso contrario.
function marcarPestanaActiva() {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
}

function marcarPestanaInactiva() {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
}

describe('useMessageSeen', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('un mensaje no esta visto hasta que llega el ping de algun receptor', () => {
    const bus = createFakeRealtimeBus()
    const emisor = montarMessageSeen(bus.createView('emisor'), 'emisor')

    expect(emisor.esVisto('m-1')).toBe(false)
  })

  it('con la pestaña del receptor activa, marcarVisto() avisa al emisor de inmediato', async () => {
    marcarPestanaActiva()
    const bus = createFakeRealtimeBus()
    const emisor = montarMessageSeen(bus.createView('emisor'), 'emisor')
    const receptor = montarMessageSeen(bus.createView('receptor'), 'receptor')

    receptor.marcarVisto('m-1')

    await vi.waitFor(() => expect(emisor.esVisto('m-1')).toBe(true))
  })

  it('con la pestaña del receptor inactiva (minimizada/en 2do plano), el ping NO sale todavia', async () => {
    marcarPestanaInactiva()
    const bus = createFakeRealtimeBus()
    const emisor = montarMessageSeen(bus.createView('emisor'), 'emisor')
    const receptor = montarMessageSeen(bus.createView('receptor'), 'receptor')

    receptor.marcarVisto('m-1')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emisor.esVisto('m-1')).toBe(false)
  })

  it('al volver la pestaña del receptor a estar activa, se manda el ping pendiente', async () => {
    marcarPestanaInactiva()
    const bus = createFakeRealtimeBus()
    const emisor = montarMessageSeen(bus.createView('emisor'), 'emisor')
    const receptor = montarMessageSeen(bus.createView('receptor'), 'receptor')

    receptor.marcarVisto('m-1')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(emisor.esVisto('m-1')).toBe(false) // todavia no, sigue inactiva

    marcarPestanaActiva()
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() => expect(emisor.esVisto('m-1')).toBe(true))
  })

  it('el propio receptor no se marca a si mismo como habiendo visto el mensaje (self:false)', async () => {
    marcarPestanaActiva()
    const bus = createFakeRealtimeBus()
    const receptor = montarMessageSeen(bus.createView('receptor'), 'receptor')

    receptor.marcarVisto('m-1')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(receptor.esVisto('m-1')).toBe(false)
  })

  it('limpiarVistoDe borra el estado (llamado cuando el mensaje se autodestruye)', async () => {
    marcarPestanaActiva()
    const bus = createFakeRealtimeBus()
    const emisor = montarMessageSeen(bus.createView('emisor'), 'emisor')
    const receptor = montarMessageSeen(bus.createView('receptor'), 'receptor')
    receptor.marcarVisto('m-1')
    await vi.waitFor(() => expect(emisor.esVisto('m-1')).toBe(true))

    emisor.limpiarVistoDe('m-1')

    expect(emisor.esVisto('m-1')).toBe(false)
  })

  it('limpiarVistoDe tambien descarta un ping que habia quedado pendiente', async () => {
    marcarPestanaInactiva()
    const bus = createFakeRealtimeBus()
    const emisor = montarMessageSeen(bus.createView('emisor'), 'emisor')
    const receptor = montarMessageSeen(bus.createView('receptor'), 'receptor')
    receptor.marcarVisto('m-1')
    await new Promise((resolve) => setTimeout(resolve, 0))

    receptor.limpiarVistoDe('m-1') // el mensaje se autodestruyo antes de que la pestaña volviera
    marcarPestanaActiva()
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emisor.esVisto('m-1')).toBe(false)
  })

  it('un segundo ping para el mismo mensaje no rompe nada (idempotente)', async () => {
    marcarPestanaActiva()
    const bus = createFakeRealtimeBus()
    const emisor = montarMessageSeen(bus.createView('emisor'), 'emisor')
    const receptor = montarMessageSeen(bus.createView('receptor'), 'receptor')

    receptor.marcarVisto('m-1')
    receptor.marcarVisto('m-1')

    await vi.waitFor(() => expect(emisor.esVisto('m-1')).toBe(true))
  })
})
