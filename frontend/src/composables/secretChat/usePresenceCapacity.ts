import { computed, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { descifrarTexto, type TextoCifrado } from '../../services/secretChat/crypto.service'

export type EstadoConexion = 'conectando' | 'conectado' | 'sala-llena' | 'error'

export interface Ocupante {
  clavePresencia: string
  apodo: string
  propio: boolean
}

// Cupo BLANDO, no una garantia dura: dos personas llegando como "la ultima"
// casi al mismo tiempo podrian pasar ambas el chequeo de abajo antes de que
// cualquiera de los dos `track()` termine su round-trip. Un cupo
// garantizado necesitaria una tabla de "asientos" en el backend (mismo
// patron atomico que el Cofre) - desproporcionado para una app de amigos
// sin cuentas. Ver backend/README.md seccion 12 y README.md de este
// dominio para el detalle completo.
export function usePresenceCapacity(
  canal: RealtimeChannel | null,
  capacidadMaxima: number,
  clave: CryptoKey,
  miClavePresencia: string | null,
) {
  const listaOcupantes = ref<Ocupante[]>([])
  const ocupantes = computed(() => listaOcupantes.value.length)
  const estado = ref<EstadoConexion>('conectando')
  // Con 2+ personas entrando casi al mismo tiempo, Supabase dispara varios
  // eventos 'sync' seguidos - como descifrar cada apodo es async, dos
  // llamadas a esta funcion pueden resolver fuera de orden (la mas vieja
  // termina despues que la mas nueva) y pisar la lista completa con una
  // version desactualizada. Este contador descarta cualquier resultado que
  // no sea el de la ultima llamada disparada.
  let versionOcupantes = 0

  async function actualizarOcupantes() {
    if (!canal) return
    const version = ++versionOcupantes
    const estadoPresencia = canal.presenceState<{ apodo: TextoCifrado }>()
    const entradas = await Promise.all(
      Object.entries(estadoPresencia).map(async ([clavePresencia, metas]) => {
        const apodoCifrado = metas[0]?.apodo
        // Descifrado nunca deberia fallar (todos comparten la misma clave de
        // sala), pero si pasa (ej. un cliente ajeno logro trackear algo en
        // el topic) no tiene sentido tirar abajo toda la lista por una fila -
        // mismo criterio de descarte silencioso que useTypingIndicator.ts.
        const apodo = apodoCifrado ? await descifrarTexto(clave, apodoCifrado).catch(() => '???') : '???'
        return { clavePresencia, apodo, propio: clavePresencia === miClavePresencia }
      }),
    )
    if (version !== versionOcupantes) return
    listaOcupantes.value = entradas
  }

  function conectar(apodoCifrado: TextoCifrado) {
    if (!canal) {
      estado.value = 'error'
      return
    }

    // Los handlers de presence/broadcast deben registrarse ANTES de
    // subscribe() - Supabase Realtime no entrega eventos de canales a los
    // que todavia no te suscribiste cuando se registro el handler.
    canal.on('presence', { event: 'sync' }, () => {
      void actualizarOcupantes()
    })

    canal.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      if (ocupantes.value >= capacidadMaxima) {
        estado.value = 'sala-llena'
        return
      }
      await canal.track({ apodo: apodoCifrado })
      estado.value = 'conectado'
    })
  }

  return { ocupantes, listaOcupantes, estado, conectar }
}
