// Doble en memoria de RealtimeChannel (Supabase) para tests - no toca red
// ni WebSocket. Un "bus" representa UNA sala; cada llamada a
// bus.createView() simula una pestaña/participante distinto conectandose al
// mismo topic, cada uno con handlers y estado de presence propios pero
// compartiendo el mismo pub/sub - asi se puede simular a dos personas
// reales intercambiando mensajes en la misma sala dentro de un solo test
// (ver useKickVote.spec.ts, usePresenceCapacity.spec.ts,
// useTypingIndicator.spec.ts, useSecretChatRoom.spec.ts).
//
// Reglas replicadas a proposito, porque el codigo de produccion depende de
// ellas (ver services/secretChat/realtime.service.ts):
// - broadcast con self:false: `send()` NUNCA dispara los handlers de la
//   propia vista que envio, solo los de las demas vistas del mismo bus.
// - presence SI se notifica a la propia vista (track/untrack disparan
//   'sync' en TODAS las vistas, incluida la que trackeo/destrackeo).
// - la entrega es asincrona (microtask), igual que un mensaje real por
//   WebSocket - los tests que dependen de esto deben esperar con
//   `await flushPromises()` o `await vi.waitFor(...)`.

type BroadcastCallback = (mensaje: { payload: unknown }) => void
type PresenceCallback = () => void

export interface FakeChannelView {
  on(type: 'broadcast', filter: { event: string }, callback: BroadcastCallback): FakeChannelView
  on(type: 'presence', filter: { event: 'sync' }, callback: PresenceCallback): FakeChannelView
  subscribe(callback: (status: string) => void): FakeChannelView
  track(payload: unknown): Promise<void>
  untrack(): Promise<void>
  send(mensaje: { type: 'broadcast'; event: string; payload: unknown }): Promise<void>
  presenceState<T>(): Record<string, T[]>
}

interface Vista {
  presenceKey: string
  broadcastHandlers: Map<string, BroadcastCallback[]>
  presenceHandlers: PresenceCallback[]
}

export interface FakeRealtimeBus {
  createView(presenceKey: string): FakeChannelView
}

function siguienteTick(): Promise<void> {
  return Promise.resolve().then(() => undefined)
}

export function createFakeRealtimeBus(): FakeRealtimeBus {
  const vistas: Vista[] = []
  const presenceState = new Map<string, unknown[]>()

  function notificarPresenceATodos() {
    for (const vista of vistas) {
      for (const handler of vista.presenceHandlers) handler()
    }
  }

  function createView(presenceKey: string): FakeChannelView {
    const vista: Vista = { presenceKey, broadcastHandlers: new Map(), presenceHandlers: [] }
    vistas.push(vista)

    const view: FakeChannelView = {
      on(type, filter, callback) {
        if (type === 'broadcast') {
          const lista = vista.broadcastHandlers.get(filter.event) ?? []
          lista.push(callback as BroadcastCallback)
          vista.broadcastHandlers.set(filter.event, lista)
        } else {
          vista.presenceHandlers.push(callback as PresenceCallback)
        }
        return view
      },

      subscribe(callback) {
        // Real Supabase entrega un 'sync' de presence con el estado YA
        // vigente apenas te suscribis (no hace falta haber estado presente
        // cuando otros hicieron track). Los handlers de 'sync' del lado del
        // composable son fire-and-forget y hacen trabajo async (descifrar
        // apodos, ver usePresenceCapacity.actualizarOcupantes) - se les da
        // varios macrotasks de margen ANTES de avisar 'SUBSCRIBED', para
        // que quien lee el cupo en su callback de status (ej. el chequeo de
        // "sala llena") ya vea el estado actualizado, no uno viejo/vacio.
        void (async () => {
          await siguienteTick()
          notificarPresenceATodos()
          await new Promise((resolve) => setTimeout(resolve, 0))
          await new Promise((resolve) => setTimeout(resolve, 0))
          await new Promise((resolve) => setTimeout(resolve, 0))
          await callback('SUBSCRIBED')
        })()
        return view
      },

      async track(payload) {
        await siguienteTick()
        presenceState.set(vista.presenceKey, [payload])
        notificarPresenceATodos()
      },

      async untrack() {
        await siguienteTick()
        presenceState.delete(vista.presenceKey)
        notificarPresenceATodos()
      },

      async send(mensaje) {
        await siguienteTick()
        if (mensaje.type !== 'broadcast') return
        for (const otra of vistas) {
          if (otra === vista) continue // self:false
          for (const handler of otra.broadcastHandlers.get(mensaje.event) ?? []) {
            handler({ payload: mensaje.payload })
          }
        }
      },

      presenceState<T>() {
        const resultado: Record<string, T[]> = {}
        for (const [clave, valores] of presenceState.entries()) resultado[clave] = valores as T[]
        return resultado
      },
    }
    return view
  }

  return { createView }
}
