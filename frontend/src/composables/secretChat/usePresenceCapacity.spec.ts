import { mount } from '@vue/test-utils'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createFakeRealtimeBus, type FakeChannelView } from '../../test-support/fakeRealtimeChannel'
import { cifrarTexto, generarClaveSala, type TextoCifrado } from '../../services/secretChat/crypto.service'
import { usePresenceCapacity } from './usePresenceCapacity'

function montarPresenceCapacity(vista: FakeChannelView | null, capacidadMaxima: number, clave: CryptoKey, miClavePresencia: string | null) {
  let composable!: ReturnType<typeof usePresenceCapacity>
  mount(
    defineComponent({
      setup() {
        composable = usePresenceCapacity(vista as unknown as RealtimeChannel | null, capacidadMaxima, clave, miClavePresencia)
        return () => h('div')
      },
    }),
  )
  return composable
}

describe('usePresenceCapacity', () => {
  it('sala llena al momento de subscribe: estado=sala-llena y nunca llama a track()', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const apodoCifrado = await cifrarTexto(clave, 'yo')

    // Dos ocupantes YA trackeados antes de que llegue el tercero.
    const vistaOcupante1 = bus.createView('ocupante-1')
    const vistaOcupante2 = bus.createView('ocupante-2')
    await vistaOcupante1.track({ apodo: await cifrarTexto(clave, 'uno') })
    await vistaOcupante2.track({ apodo: await cifrarTexto(clave, 'dos') })

    const vistaNueva = bus.createView('recien-llegado')
    const trackSpy = vi.spyOn(vistaNueva, 'track')
    const composable = montarPresenceCapacity(vistaNueva, 2, clave, 'recien-llegado')

    composable.conectar(apodoCifrado)

    await vi.waitFor(() => expect(composable.estado.value).toBe('sala-llena'))
    expect(trackSpy).not.toHaveBeenCalled()
  })

  it('con lugar disponible, conectar() trackea y pasa a estado=conectado', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const apodoCifrado = await cifrarTexto(clave, 'yo')
    const vista = bus.createView('yo')
    const composable = montarPresenceCapacity(vista, 4, clave, 'yo')

    composable.conectar(apodoCifrado)

    await vi.waitFor(() => expect(composable.estado.value).toBe('conectado'))
    expect(composable.ocupantes.value).toBe(1)
  })

  it('un payload de presencia con apodo cifrado corrupto (participante hostil) cae a "???" sin romper el resto de la lista', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const otraClave = await generarClaveSala() // simula un intruso sin la clave real de la sala
    const apodoCifrado = await cifrarTexto(clave, 'yo')

    const vistaHostil = bus.createView('hostil')
    await vistaHostil.track({ apodo: await cifrarTexto(otraClave, 'intruso') }) // no descifrable con `clave`

    const vista = bus.createView('yo')
    const composable = montarPresenceCapacity(vista, 6, clave, 'yo')
    composable.conectar(apodoCifrado)

    await vi.waitFor(() => expect(composable.estado.value).toBe('conectado'))
    await vi.waitFor(() => expect(composable.listaOcupantes.value.length).toBe(2))
    const hostil = composable.listaOcupantes.value.find((o) => o.clavePresencia === 'hostil')
    expect(hostil?.apodo).toBe('???')
    const yo = composable.listaOcupantes.value.find((o) => o.clavePresencia === 'yo')
    expect(yo?.apodo).toBe('yo')
  })

  it('un payload de presencia con estructura invalida (sin campo apodo) tambien cae a "???" en vez de crashear', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const apodoCifrado = await cifrarTexto(clave, 'yo')

    const vistaHostil = bus.createView('hostil')
    await vistaHostil.track({ algoQueNoEsApodo: 'basura' } as unknown as { apodo: TextoCifrado })

    const vista = bus.createView('yo')
    const composable = montarPresenceCapacity(vista, 6, clave, 'yo')
    composable.conectar(apodoCifrado)

    await vi.waitFor(() => expect(composable.estado.value).toBe('conectado'))
    await vi.waitFor(() =>
      expect(composable.listaOcupantes.value.find((o) => o.clavePresencia === 'hostil')?.apodo).toBe('???'),
    )
  })

  it('estado=error si no hay canal (Realtime no configurado)', () => {
    const composable = montarPresenceCapacity(null, 4, {} as CryptoKey, null)

    composable.conectar({ ciphertext: 'x', nonce: 'y' })

    expect(composable.estado.value).toBe('error')
  })

  it('marca al ocupante propio segun miClavePresencia', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const apodoCifrado = await cifrarTexto(clave, 'yo')
    const vista = bus.createView('mi-clave')
    const composable = montarPresenceCapacity(vista, 4, clave, 'mi-clave')

    composable.conectar(apodoCifrado)

    await vi.waitFor(() => expect(composable.estado.value).toBe('conectado'))
    const yo = composable.listaOcupantes.value.find((o) => o.clavePresencia === 'mi-clave')
    expect(yo?.propio).toBe(true)
  })
})
