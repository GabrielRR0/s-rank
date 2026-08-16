import { onUnmounted, ref, type Ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  crearKickVoteCastEnvelope,
  crearKickVoteResultEnvelope,
  crearKickVoteStartEnvelope,
  EVENTO_VOTO_EXPULSION_EXPULSADO,
  EVENTO_VOTO_EXPULSION_INICIAR,
  EVENTO_VOTO_EXPULSION_VOTAR,
  type KickVoteCastEnvelope,
  type KickVoteResultEnvelope,
  type KickVoteStartEnvelope,
} from '../../services/secretChat/chat.service'
import { removeRoomChannel } from '../../services/secretChat/realtime.service'
import { PATRON_VOTO_EMITIDO, vibrar } from '../../services/secretChat/haptics.service'
import { marcarExpulsado, limpiarSesion } from './useRoomSession'
import type { Ocupante } from './usePresenceCapacity'

// Expulsion por voto de mayoria: 100% cliente/broadcast, sin backend
// involucrado - ver README.md de este dominio para el detalle completo y la
// limitacion aceptada (aplicacion social/blanda, no criptografica: un
// cliente modificado a mano puede ignorar el evento de expulsion).
//
// 30s de ventana antes de que un voto vencido se descarte en silencio.
const VENTANA_VOTO_MS = 30_000

export interface VotoExpulsionActivo {
  votoId: string
  objetivoClavePresencia: string
  objetivoApodo: string
  votantes: Set<string>
  venceEn: number
}

export function useKickVote(
  canal: RealtimeChannel | null,
  roomId: string,
  miClavePresencia: string | null,
  listaOcupantes: Ref<Ocupante[]>,
) {
  const votoActivo = ref<VotoExpulsionActivo | null>(null)
  const expulsado = ref(false)
  let timeoutVencimiento: ReturnType<typeof setTimeout> | undefined

  function limpiarVoto() {
    if (timeoutVencimiento) clearTimeout(timeoutVencimiento)
    timeoutVencimiento = undefined
    votoActivo.value = null
  }

  function manejarInicio(envelope: KickVoteStartEnvelope) {
    // Un solo voto activo a la vez por sala - uno nuevo mientras hay otro en
    // curso se ignora (simplicidad razonable para una sala de 2-6 personas).
    if (votoActivo.value) return
    const objetivo = listaOcupantes.value.find((ocupante) => ocupante.clavePresencia === envelope.objetivoClavePresencia)
    votoActivo.value = {
      votoId: envelope.votoId,
      objetivoClavePresencia: envelope.objetivoClavePresencia,
      objetivoApodo: objetivo?.apodo ?? '???',
      // El voto "si" de quien inicia ya queda contado aca - arrancar un
      // voto ya implica querer que esa persona se vaya, sin un click extra.
      votantes: new Set([envelope.iniciadorClavePresencia]),
      venceEn: envelope.iniciadoEn + VENTANA_VOTO_MS,
    }
    timeoutVencimiento = setTimeout(limpiarVoto, Math.max(0, votoActivo.value.venceEn - Date.now()))
  }

  function manejarVoto(envelope: KickVoteCastEnvelope) {
    const voto = votoActivo.value
    if (!voto || voto.votoId !== envelope.votoId) return
    // El objetivo no puede votar su propia expulsion - defensa en
    // profundidad, la prevencion principal es que su propio cliente ya
    // oculta el boton de votar (ver KickVoteBanner.vue/OccupantList.vue).
    if (envelope.votanteClavePresencia === voto.objetivoClavePresencia) return
    voto.votantes.add(envelope.votanteClavePresencia)

    // Cada cliente cuenta de forma independiente, sin coordinador, contra
    // el conteo de ocupantes VIGENTE (no el de cuando arranco el voto) -
    // "se analiza cuantos son" en el momento de cada voto, no un umbral
    // congelado al inicio. Inofensivo si mas de un cliente cruza el umbral
    // casi a la vez y ambos transmiten el resultado: es idempotente.
    const mayoria = Math.floor(listaOcupantes.value.length / 2) + 1
    if (voto.votantes.size >= mayoria && canal) {
      canal.send({
        type: 'broadcast',
        event: EVENTO_VOTO_EXPULSION_EXPULSADO,
        payload: crearKickVoteResultEnvelope(voto.votoId, voto.objetivoClavePresencia),
      })
    }
  }

  function manejarExpulsado(envelope: KickVoteResultEnvelope) {
    if (!votoActivo.value || votoActivo.value.votoId !== envelope.votoId) return
    limpiarVoto()
    if (envelope.objetivoClavePresencia !== miClavePresencia) return
    // Ni un refresh de pagina debe volver a dejar entrar a quien fue
    // expulsado - limpiar solo la sesion no alcanza, ver useRoomSession.ts.
    canal?.untrack()
    removeRoomChannel(roomId)
    limpiarSesion(roomId)
    marcarExpulsado(roomId)
    expulsado.value = true
  }

  if (canal) {
    canal
      .on('broadcast', { event: EVENTO_VOTO_EXPULSION_INICIAR }, ({ payload }) =>
        manejarInicio(payload as KickVoteStartEnvelope),
      )
      .on('broadcast', { event: EVENTO_VOTO_EXPULSION_VOTAR }, ({ payload }) =>
        manejarVoto(payload as KickVoteCastEnvelope),
      )
      .on('broadcast', { event: EVENTO_VOTO_EXPULSION_EXPULSADO }, ({ payload }) =>
        manejarExpulsado(payload as KickVoteResultEnvelope),
      )
  }

  function votar() {
    const voto = votoActivo.value
    if (!voto || !canal || !miClavePresencia) return
    if (miClavePresencia === voto.objetivoClavePresencia || voto.votantes.has(miClavePresencia)) return
    canal.send({
      type: 'broadcast',
      event: EVENTO_VOTO_EXPULSION_VOTAR,
      payload: crearKickVoteCastEnvelope(voto.votoId, miClavePresencia),
    })
    vibrar(PATRON_VOTO_EMITIDO)
    // broadcast.self:false (ver realtime.service.ts) - el propio voto no
    // vuelve solo, hay que contarlo a mano igual que enviarMensaje().
    manejarVoto({ votoId: voto.votoId, votanteClavePresencia: miClavePresencia })
  }

  function iniciarVoto(objetivoClavePresencia: string) {
    if (!canal || !miClavePresencia) return
    if (votoActivo.value || objetivoClavePresencia === miClavePresencia) return
    const envelope = crearKickVoteStartEnvelope(objetivoClavePresencia, miClavePresencia)
    canal.send({ type: 'broadcast', event: EVENTO_VOTO_EXPULSION_INICIAR, payload: envelope })
    // Mismo motivo que en votar(): self:false, hay que aplicarlo local.
    manejarInicio(envelope)
  }

  onUnmounted(limpiarVoto)

  return { votoActivo, expulsado, iniciarVoto, votar }
}
