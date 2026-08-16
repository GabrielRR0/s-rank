import { reactive } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { cifrarTexto, descifrarTexto } from '../../services/secretChat/crypto.service'
import { crearReaccionEnvelope, EVENTO_REACCION, type ReaccionEnvelope } from '../../services/secretChat/chat.service'

// Set fijo de 6 emojis (ver MessageActionBar.vue) - mas simple/rapido de
// usar que un picker completo, consistente con el resto de la app.
export const EMOJIS_REACCION = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

export interface ResumenReaccion {
  emoji: string
  cantidad: number
  propia: boolean
}

// Mismo molde que useKickVote.ts: cada cliente acumula de forma
// independiente, sin coordinador, a partir de los broadcasts que recibe.
// El estado crudo (Map de Sets, para saber rapido "esta persona ya
// reacciono con este emoji") vive fuera de la reactividad de Vue a
// proposito - lo que el template consume es `reaccionesPorMensaje`, un
// objeto reactivo con arrays planos (mensajeId -> ResumenReaccion[]),
// mas simple de iterar con v-for que un Map anidado.
export function useMessageReactions(canal: RealtimeChannel | null, clave: CryptoKey, miClavePresencia: string | null) {
  const crudo = new Map<string, Map<string, Set<string>>>()
  const reaccionesPorMensaje = reactive<Record<string, ResumenReaccion[]>>({})

  function recalcularResumen(mensajeId: string) {
    const mapaEmoji = crudo.get(mensajeId)
    if (!mapaEmoji || mapaEmoji.size === 0) {
      delete reaccionesPorMensaje[mensajeId]
      return
    }
    reaccionesPorMensaje[mensajeId] = Array.from(mapaEmoji.entries()).map(([emoji, quienes]) => ({
      emoji,
      cantidad: quienes.size,
      propia: miClavePresencia !== null && quienes.has(miClavePresencia),
    }))
  }

  function aplicar(mensajeId: string, emoji: string, autorClavePresencia: string, accion: 'agregar' | 'quitar') {
    let mapaEmoji = crudo.get(mensajeId)
    if (!mapaEmoji) {
      mapaEmoji = new Map()
      crudo.set(mensajeId, mapaEmoji)
    }
    let quienes = mapaEmoji.get(emoji)
    if (accion === 'agregar') {
      if (!quienes) {
        quienes = new Set()
        mapaEmoji.set(emoji, quienes)
      }
      quienes.add(autorClavePresencia)
    } else if (quienes) {
      quienes.delete(autorClavePresencia)
      if (quienes.size === 0) mapaEmoji.delete(emoji)
    }
    if (mapaEmoji.size === 0) crudo.delete(mensajeId)
    recalcularResumen(mensajeId)
  }

  async function manejarReaccion(envelope: ReaccionEnvelope) {
    try {
      const emoji = await descifrarTexto(clave, envelope.emoji)
      aplicar(envelope.mensajeId, emoji, envelope.autorClavePresencia, envelope.accion)
    } catch {
      // Clave incorrecta o payload corrupto - se descarta en silencio, mismo
      // criterio que manejarMensajeEntrante en useSecretChatRoom.ts.
    }
  }

  if (canal) {
    canal.on('broadcast', { event: EVENTO_REACCION }, ({ payload }) => manejarReaccion(payload as ReaccionEnvelope))
  }

  // Toggle: si ya reaccione con ese emoji, el mismo tap la retira.
  async function reaccionar(mensajeId: string, emoji: string) {
    if (!canal || !miClavePresencia) return
    const yaReacciono = crudo.get(mensajeId)?.get(emoji)?.has(miClavePresencia) ?? false
    const accion: 'agregar' | 'quitar' = yaReacciono ? 'quitar' : 'agregar'
    const emojiCifrado = await cifrarTexto(clave, emoji)
    const envelope = crearReaccionEnvelope(mensajeId, miClavePresencia, emojiCifrado, accion)
    canal.send({ type: 'broadcast', event: EVENTO_REACCION, payload: envelope })
    // broadcast.self:false (ver realtime.service.ts) - aplicar local igual
    // que useKickVote.votar().
    aplicar(mensajeId, emoji, miClavePresencia, accion)
  }

  // Se llama desde el onQuitar de useEphemeralMessages cuando el mensaje
  // padre se autodestruye - sin esto, las reacciones de un mensaje ya
  // desaparecido quedarian acumulandose en memoria para siempre.
  function limpiarReaccionesDe(mensajeId: string) {
    crudo.delete(mensajeId)
    delete reaccionesPorMensaje[mensajeId]
  }

  return { reaccionesPorMensaje, reaccionar, limpiarReaccionesDe }
}
