import { onUnmounted, ref } from 'vue'
import { reproducirSonidoMensaje } from '../../services/secretChat/sound.service'

export interface MensajeChat {
  id: string
  autor: string
  propio: boolean
  enviadoEn: number
  tipo: 'texto' | 'media'
  // Uno u otro segun `tipo`, nunca ambos - ver MessageBubble.vue. Para
  // media, tambien es uno u otro segun `mimeType`: imagen usa `mediaUrl`
  // (Blob URL, para <img src>), audio usa `mediaDatos` (ArrayBuffer crudo,
  // para AudioPlayer.vue/useAudioPlayer.ts, que decodifica con la Web Audio
  // API en vez de un <audio src> nativo - ver secretChat/README.md).
  texto?: string
  mediaUrl?: string
  mediaDatos?: ArrayBuffer
  mimeType?: string
}

function revocarSiEsMedia(mensaje: MensajeChat | undefined) {
  // Los mensajes de imagen/audio construyen un Blob URL local para
  // mostrarlos (ver useSecretChatRoom.manejarMediaPointer) - sin revocarlo
  // al autodestruirse, cada uno dejaria una fuga de memoria silenciosa por
  // el resto de la vida de la pestaña.
  if (mensaje?.tipo === 'media' && mensaje.mediaUrl) URL.revokeObjectURL(mensaje.mediaUrl)
}

// Estado 100% local: ningun mensaje se guarda en ningun lado antes de
// llegar aca (Supabase Broadcast es pub/sub puro, nunca toca Postgres - ver
// backend/README.md seccion 12), asi que "autodestruir" un mensaje es
// simplemente sacarlo de este array reactivo. Sin round-trip al servidor.
export function useEphemeralMessages(ttlSegundos: number) {
  const mensajes = ref<MensajeChat[]>([])
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()

  function quitar(id: string) {
    revocarSiEsMedia(mensajes.value.find((mensaje) => mensaje.id === id))
    mensajes.value = mensajes.value.filter((mensaje) => mensaje.id !== id)
    const timeout = timeouts.get(id)
    if (timeout) clearTimeout(timeout)
    timeouts.delete(id)
  }

  function agregar(mensaje: MensajeChat) {
    mensajes.value.push(mensaje)
    reproducirSonidoMensaje()
    timeouts.set(
      mensaje.id,
      setTimeout(() => quitar(mensaje.id), ttlSegundos * 1000),
    )
  }

  onUnmounted(() => {
    for (const timeout of timeouts.values()) clearTimeout(timeout)
    timeouts.clear()
    for (const mensaje of mensajes.value) revocarSiEsMedia(mensaje)
  })

  return { mensajes, agregar }
}
