import { onUnmounted, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { crearVistoEnvelope, EVENTO_MENSAJE_VISTO, type VistoEnvelope } from '../../services/secretChat/chat.service'
import { pestanaInactiva } from '../../services/secretChat/notification.service'

// "Visto": un solo ping simple (alguien mas ya vio el mensaje), sin
// distinguir entregado/leido ni trackear por persona - decision ya
// confirmada (los TTLs cortos de este chat, 5-60s, hacen que un tally
// completo tipo WhatsApp valga poco por su complejidad).
//
// "Ya vio" != "el navegador ya lo desencripto": una pestaña minimizada/en
// segundo plano sigue con el WebSocket vivo y sigue procesando mensajes
// (asi es como tambien funcionan las notificaciones), asi que marcar visto
// apenas se desencripta confirmaria de mas - la persona podria no estar
// mirando la pantalla en absoluto. El ping real se retiene hasta que la
// pestaña vuelve a estar activa (visible y con foco), igual que el tilde
// azul de WhatsApp (requiere abrir el chat, no solo que el telefono lo reciba).
export function useMessageSeen(canal: RealtimeChannel | null, miClavePresencia: string | null) {
  const vistos = ref<Set<string>>(new Set())
  const pendientes = new Set<string>()

  function manejarVisto(envelope: VistoEnvelope) {
    if (vistos.value.has(envelope.mensajeId)) return
    // Reasignar (no mutar in-place) para que el ref dispare reactividad.
    vistos.value = new Set(vistos.value).add(envelope.mensajeId)
  }

  if (canal) {
    canal.on('broadcast', { event: EVENTO_MENSAJE_VISTO }, ({ payload }) => manejarVisto(payload as VistoEnvelope))
  }

  function enviarPing(mensajeId: string) {
    canal?.send({
      type: 'broadcast',
      event: EVENTO_MENSAJE_VISTO,
      payload: crearVistoEnvelope(mensajeId, miClavePresencia as string),
    })
  }

  // Se llama al desencriptar exitosamente un mensaje ajeno (ver
  // manejarMensajeEntrante/manejarMediaPointer en useSecretChatRoom.ts). Si
  // la pestaña esta activa en ese momento, el ping sale ya mismo; si no,
  // queda pendiente hasta que vuelva a estarlo (ver el listener mas abajo).
  function marcarVisto(mensajeId: string) {
    if (!canal || !miClavePresencia) return
    if (pestanaInactiva()) {
      pendientes.add(mensajeId)
      return
    }
    enviarPing(mensajeId)
  }

  function manejarVolverAEstarActiva() {
    if (pendientes.size === 0 || pestanaInactiva()) return
    for (const mensajeId of pendientes) enviarPing(mensajeId)
    pendientes.clear()
  }

  document.addEventListener('visibilitychange', manejarVolverAEstarActiva)
  window.addEventListener('focus', manejarVolverAEstarActiva)
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', manejarVolverAEstarActiva)
    window.removeEventListener('focus', manejarVolverAEstarActiva)
  })

  function esVisto(mensajeId: string): boolean {
    return vistos.value.has(mensajeId)
  }

  // Se llama desde el onQuitar de useEphemeralMessages cuando el mensaje
  // padre se autodestruye - evita acumular ids vencidos para siempre. Un
  // mensaje que se autodestruye antes de que la pestaña receptora vuelva a
  // estar activa nunca llega a marcarse visto - se acepta (mismo criterio
  // de "el TTL es la unica garantia" que el resto de la app).
  function limpiarVistoDe(mensajeId: string) {
    pendientes.delete(mensajeId)
    if (!vistos.value.has(mensajeId)) return
    const copia = new Set(vistos.value)
    copia.delete(mensajeId)
    vistos.value = copia
  }

  return { esVisto, marcarVisto, limpiarVistoDe }
}
