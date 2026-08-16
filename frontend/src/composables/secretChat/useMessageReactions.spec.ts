import { mount } from '@vue/test-utils'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createFakeRealtimeBus, type FakeChannelView } from '../../test-support/fakeRealtimeChannel'
import { generarClaveSala } from '../../services/secretChat/crypto.service'
import { useMessageReactions } from './useMessageReactions'

function montarMessageReactions(vista: FakeChannelView | null, clave: CryptoKey, miClavePresencia: string | null) {
  let composable!: ReturnType<typeof useMessageReactions>
  mount(
    defineComponent({
      setup() {
        composable = useMessageReactions(vista as unknown as RealtimeChannel | null, clave, miClavePresencia)
        return () => h('div')
      },
    }),
  )
  return composable
}

describe('useMessageReactions', () => {
  it('reaccionar() aplica la reaccion localmente de inmediato (self:false compensado)', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const a = montarMessageReactions(bus.createView('a'), clave, 'a')

    await a.reaccionar('m-1', '👍')

    expect(a.reaccionesPorMensaje['m-1']).toEqual([{ emoji: '👍', cantidad: 1, propia: true }])
  })

  it('la reaccion de otro participante llega y se agrega al mismo mensaje', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const a = montarMessageReactions(bus.createView('a'), clave, 'a')
    const b = montarMessageReactions(bus.createView('b'), clave, 'b')

    await a.reaccionar('m-1', '👍')
    await vi.waitFor(() => expect(b.reaccionesPorMensaje['m-1']).toEqual([{ emoji: '👍', cantidad: 1, propia: false }]))
  })

  it('tocar el mismo emoji de nuevo la retira (toggle)', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const a = montarMessageReactions(bus.createView('a'), clave, 'a')

    await a.reaccionar('m-1', '👍')
    await a.reaccionar('m-1', '👍')

    expect(a.reaccionesPorMensaje['m-1']).toBeUndefined()
  })

  it('dos emojis distintos en el mismo mensaje se cuentan por separado', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const a = montarMessageReactions(bus.createView('a'), clave, 'a')
    const b = montarMessageReactions(bus.createView('b'), clave, 'b')

    await a.reaccionar('m-1', '👍')
    await b.reaccionar('m-1', '❤️')

    await vi.waitFor(() =>
      expect(a.reaccionesPorMensaje['m-1']).toEqual(
        expect.arrayContaining([
          { emoji: '👍', cantidad: 1, propia: true },
          { emoji: '❤️', cantidad: 1, propia: false },
        ]),
      ),
    )
  })

  it('limpiarReaccionesDe borra el estado del mensaje (llamado cuando el mensaje se autodestruye)', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const a = montarMessageReactions(bus.createView('a'), clave, 'a')
    await a.reaccionar('m-1', '👍')

    a.limpiarReaccionesDe('m-1')

    expect(a.reaccionesPorMensaje['m-1']).toBeUndefined()
  })

  it('un payload que no se puede descifrar se ignora sin romper nada', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const otraClave = await generarClaveSala()
    const a = montarMessageReactions(bus.createView('a'), clave, 'a')
    const atacante = montarMessageReactions(bus.createView('atacante'), otraClave, 'atacante')

    await expect(atacante.reaccionar('m-1', '👍')).resolves.not.toThrow()
    await vi.waitFor(() => expect(a.reaccionesPorMensaje['m-1']).toBeUndefined())
  })
})
