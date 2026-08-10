import { flushPromises, mount } from '@vue/test-utils'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { createFakeRealtimeBus, type FakeChannelView } from '../../test-support/fakeRealtimeChannel'
import { useKickVote } from './useKickVote'
import type { Ocupante } from './usePresenceCapacity'
import { fueExpulsado, guardarSesion, hasValidSession } from './useRoomSession'

// Cada llamada monta un componente host real (igual que useOneTimeView.spec.ts)
// para que onUnmounted() dentro de useKickVote tenga una instancia activa a
// la cual asociarse - simula UN participante conectado a la sala.
function montarParticipante(
  vista: FakeChannelView,
  roomId: string,
  miClavePresencia: string,
  listaOcupantes: Ref<Ocupante[]>,
) {
  let composable!: ReturnType<typeof useKickVote>
  mount(
    defineComponent({
      setup() {
        composable = useKickVote(vista as unknown as RealtimeChannel, roomId, miClavePresencia, listaOcupantes)
        return () => h('div')
      },
    }),
  )
  return composable
}

function ocupante(clavePresencia: string, apodo = 'alguien'): Ocupante {
  return { clavePresencia, apodo, propio: false }
}

describe('useKickVote', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('en una sala de 2 personas la expulsion es imposible: la mayoria exige 2 votos pero el objetivo no puede votar, asi que solo hay 1 votante posible', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-de-2'
    const listaOcupantes = ref<Ocupante[]>([ocupante('a'), ocupante('b')])
    const kickA = montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes)

    kickA.iniciarVoto('b') // el propio "si" de a ya cuenta - es el unico voto posible
    await flushPromises()

    // El voto queda abierto para siempre (hasta que expire a los 30s) en
    // vez de expulsar con un solo voto - documenta un limite real de
    // diseño, no un bug: una sala de 2 no puede autoexpulsar a nadie.
    expect(kickA.votoActivo.value).not.toBeNull()
    expect(kickA.votoActivo.value?.votantes.size).toBe(1)
  })

  it('la mayoria se calcula correctamente para cupos de 3 a 6 (en salas de 2 la expulsion es imposible, ver test aparte)', async () => {
    const casos: Array<{ ocupantes: number; mayoriaEsperada: number }> = [
      { ocupantes: 3, mayoriaEsperada: 2 },
      { ocupantes: 4, mayoriaEsperada: 3 },
      { ocupantes: 5, mayoriaEsperada: 3 },
      { ocupantes: 6, mayoriaEsperada: 4 },
    ]

    for (const caso of casos) {
      const bus = createFakeRealtimeBus()
      const roomId = `sala-mayoria-${caso.ocupantes}`
      const objetivo = 'clave-objetivo'
      const listaOcupantes = ref<Ocupante[]>(
        Array.from({ length: caso.ocupantes }, (_, i) => ocupante(i === 0 ? objetivo : `votante-${i}`)),
      )
      montarParticipante(bus.createView(objetivo), roomId, objetivo, listaOcupantes)

      const votantes = listaOcupantes.value.filter((o) => o.clavePresencia !== objetivo)
      const kickVotesVotantes = votantes.map((v) => montarParticipante(bus.createView(v.clavePresencia), roomId, v.clavePresencia, listaOcupantes))

      let objetivoExpulsado = false
      bus.createView('espia').on('broadcast', { event: 'kick-vote-kicked' }, () => {
        objetivoExpulsado = true
      })

      // El primer votante inicia el voto (su propio "si" ya cuenta).
      kickVotesVotantes[0].iniciarVoto(objetivo)
      await flushPromises()

      for (let i = 1; i < kickVotesVotantes.length && !objetivoExpulsado; i++) {
        kickVotesVotantes[i].votar()
        await flushPromises()
        const votosActuales = i + 1 // el iniciador + los que ya votaron
        if (votosActuales >= caso.mayoriaEsperada) {
          expect(
            objetivoExpulsado,
            `con ${caso.ocupantes} ocupantes y ${votosActuales} votos deberia haberse alcanzado la mayoria (${caso.mayoriaEsperada})`,
          ).toBe(true)
        } else {
          expect(
            objetivoExpulsado,
            `con ${caso.ocupantes} ocupantes y solo ${votosActuales} votos NO deberia alcanzarse la mayoria (${caso.mayoriaEsperada})`,
          ).toBe(false)
        }
      }
    }
  })

  it('el objetivo no puede votar su propia expulsion (defensa en profundidad, aunque el boton ya este oculto)', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-1'
    const listaOcupantes = ref<Ocupante[]>([ocupante('a'), ocupante('b'), ocupante('c')])
    const kickA = montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes)
    montarParticipante(bus.createView('b'), roomId, 'b', listaOcupantes)

    kickA.iniciarVoto('b')
    await flushPromises()
    // "b" (el objetivo) vota su propia expulsion desde un cliente
    // modificado a mano, enviando el broadcast directo sin pasar por su
    // propio composable (que ya oculta el boton, pero un atacante no usa el UI).
    const votoId = kickA.votoActivo.value?.votoId
    await bus
      .createView('b-forjado')
      .send({ type: 'broadcast', event: 'kick-vote-cast', payload: { votoId, votanteClavePresencia: 'b' } })
    await flushPromises()

    expect(kickA.votoActivo.value?.votantes.has('b')).toBe(false)
  })

  it('un voto duplicado del mismo participante no suma dos veces', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-1'
    const listaOcupantes = ref<Ocupante[]>([ocupante('a'), ocupante('b'), ocupante('c'), ocupante('d')])
    const kickA = montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes)
    const kickB = montarParticipante(bus.createView('b'), roomId, 'b', listaOcupantes)

    kickA.iniciarVoto('d')
    await flushPromises()
    kickB.votar()
    await flushPromises()
    kickB.votar() // clickea el boton de nuevo, o su cliente reenvia el evento
    await flushPromises()

    expect(kickA.votoActivo.value?.votantes.size).toBe(2) // a (iniciador) + b, no 3
  })

  it('un kick-vote-cast con votoId que no coincide con el voto activo se ignora (voto falso inyectado)', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-1'
    const listaOcupantes = ref<Ocupante[]>([ocupante('a'), ocupante('b'), ocupante('c')])
    const kickA = montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes)
    montarParticipante(bus.createView('b'), roomId, 'b', listaOcupantes)

    kickA.iniciarVoto('c')
    await flushPromises()
    const votoIdReal = kickA.votoActivo.value?.votoId

    await bus.createView('atacante').send({
      type: 'broadcast',
      event: 'kick-vote-cast',
      payload: { votoId: 'voto-inventado-que-no-existe', votanteClavePresencia: 'b' },
    })
    await flushPromises()

    expect(kickA.votoActivo.value?.votoId).toBe(votoIdReal)
    expect(kickA.votoActivo.value?.votantes.has('b')).toBe(false)
  })

  it('el voto vence solo a los 30 segundos si no alcanza mayoria', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-1'
    const listaOcupantes = ref<Ocupante[]>(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((clave) => ocupante(clave)),
    )
    const kickA = montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes)

    kickA.iniciarVoto('f')
    await flushPromises()
    expect(kickA.votoActivo.value).not.toBeNull()

    vi.advanceTimersByTime(30_000)
    await flushPromises()

    expect(kickA.votoActivo.value).toBeNull()
  })

  it('solo puede haber un voto activo por vez - iniciar uno nuevo mientras hay otro en curso se ignora', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-1'
    const listaOcupantes = ref<Ocupante[]>([ocupante('a'), ocupante('b'), ocupante('c')])
    const kickA = montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes)

    kickA.iniciarVoto('b')
    await flushPromises()
    const votoIdOriginal = kickA.votoActivo.value?.votoId

    kickA.iniciarVoto('c') // intenta arrancar otro voto contra alguien mas
    await flushPromises()

    expect(kickA.votoActivo.value?.votoId).toBe(votoIdOriginal)
    expect(kickA.votoActivo.value?.objetivoClavePresencia).toBe('b')
  })

  it('no se puede iniciar un voto contra uno mismo', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-1'
    const listaOcupantes = ref<Ocupante[]>([ocupante('a'), ocupante('b')])
    const kickA = montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes)

    kickA.iniciarVoto('a')
    await flushPromises()

    expect(kickA.votoActivo.value).toBeNull()
  })

  it('ser el objetivo de una expulsion exitosa limpia la sesion y marca expulsado=true', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-a-expulsar'
    guardarSesion(roomId, 'token-de-sesion', new Date(Date.now() + 60_000).toISOString())
    expect(hasValidSession(roomId)).toBe(true)

    const listaOcupantes = ref<Ocupante[]>([ocupante('a'), ocupante('b'), ocupante('c')])
    montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes) // el objetivo
    const kickB = montarParticipante(bus.createView('b'), roomId, 'b', listaOcupantes)
    const kickC = montarParticipante(bus.createView('c'), roomId, 'c', listaOcupantes)

    kickB.iniciarVoto('a') // 1er voto (el propio de b)
    await flushPromises()
    kickC.votar() // 2do voto -> mayoria de 3 ocupantes (floor(3/2)+1 = 2)
    await flushPromises()

    expect(hasValidSession(roomId)).toBe(false)
    expect(fueExpulsado(roomId)).toBe(true)
  })

  it('ver que OTRA persona fue expulsada no me desloguea a mi', async () => {
    const bus = createFakeRealtimeBus()
    const roomId = 'sala-observador'
    guardarSesion(roomId, 'token-de-sesion', new Date(Date.now() + 60_000).toISOString())

    const listaOcupantes = ref<Ocupante[]>([ocupante('a'), ocupante('b'), ocupante('c')])
    const kickA = montarParticipante(bus.createView('a'), roomId, 'a', listaOcupantes) // observador
    bus.createView('b') // el objetivo, sin useKickVote propio en este test
    const kickC = montarParticipante(bus.createView('c'), roomId, 'c', listaOcupantes)

    kickA.iniciarVoto('b')
    await flushPromises()
    kickC.votar()
    await flushPromises()

    expect(kickA.expulsado.value).toBe(false)
    expect(hasValidSession(roomId)).toBe(true)
  })
})
