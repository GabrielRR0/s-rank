import { onUnmounted, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { cifrarTexto, descifrarTexto, type TextoCifrado } from '../../services/secretChat/crypto.service'
import { EVENTO_ESCRIBIENDO } from '../../services/secretChat/chat.service'

// Sin "dejo de escribir" explicito: cada aviso recibido reinicia un
// temporizador local de expiracion (mismo principio que useEphemeralMessages -
// autolimpieza local en vez de un evento extra). Si alguien deja de escribir
// (o cierra la pestaña) el indicador desaparece solo, sin necesitar avisar nada.
const EXPIRACION_MS = 3000
// No se manda un broadcast por cada tecla - alcanza con avisar una vez cada
// tantos milisegundos mientras la persona sigue escribiendo.
const THROTTLE_MS = 1500

export function useTypingIndicator(canal: RealtimeChannel | null, clave: CryptoKey, apodoPropio: string) {
  const escribiendo = ref<string[]>([])
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  let ultimoEnvio = 0

  function detener(autor: string) {
    escribiendo.value = escribiendo.value.filter((nombre) => nombre !== autor)
    const timeout = timeouts.get(autor)
    if (timeout) clearTimeout(timeout)
    timeouts.delete(autor)
  }

  async function manejarEscribiendo(payload: TextoCifrado) {
    let autor: string
    try {
      autor = await descifrarTexto(clave, payload)
    } catch {
      return
    }
    if (autor === apodoPropio) return

    if (!escribiendo.value.includes(autor)) escribiendo.value.push(autor)
    const timeoutAnterior = timeouts.get(autor)
    if (timeoutAnterior) clearTimeout(timeoutAnterior)
    timeouts.set(
      autor,
      setTimeout(() => detener(autor), EXPIRACION_MS),
    )
  }

  if (canal) {
    canal.on('broadcast', { event: EVENTO_ESCRIBIENDO }, ({ payload }) => manejarEscribiendo(payload as TextoCifrado))
  }

  async function notificarEscribiendo() {
    if (!canal) return
    const ahora = Date.now()
    if (ahora - ultimoEnvio < THROTTLE_MS) return
    ultimoEnvio = ahora
    const autorCifrado = await cifrarTexto(clave, apodoPropio)
    canal.send({ type: 'broadcast', event: EVENTO_ESCRIBIENDO, payload: autorCifrado })
  }

  onUnmounted(() => {
    for (const timeout of timeouts.values()) clearTimeout(timeout)
    timeouts.clear()
  })

  return { escribiendo, notificarEscribiendo, detener }
}
