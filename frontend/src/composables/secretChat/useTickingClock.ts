import { onUnmounted, ref } from 'vue'

// Singleton a nivel de modulo: un solo setInterval mientras una sala esta
// conectada, en vez de que cada MessageBubble corra el suyo (era el caso
// antes - una sala con muchos mensajes visibles corria un timer por
// burbuja). Se arranca/para una sola vez desde ChatRoomConnected.vue (dueño
// natural del ciclo de vida de la conexion) - MessageBubble.vue solo LEE
// este ref exportado, sin llamar useTickingClock() por su cuenta: las
// burbujas van y vienen todo el tiempo por el TTL, suscribirse/
// desuscribirse en cada una prenderia/apagaria el interval sin necesidad.
export const ahora = ref(Date.now())

let intervalo: ReturnType<typeof setInterval> | undefined

export function useTickingClock() {
  if (!intervalo) {
    intervalo = setInterval(() => {
      ahora.value = Date.now()
    }, 1000)
  }

  onUnmounted(() => {
    if (intervalo) clearInterval(intervalo)
    intervalo = undefined
  })

  return { ahora }
}
