import { computed, ref } from 'vue'
import {
  mostrarNotificacionMensaje,
  notificacionesSoportadas,
  pedirPermisoNotificaciones,
  pestanaInactiva,
} from '../../services/secretChat/notification.service'
import { useLocale } from '../../i18n/useLocale'

const ICONO_NOTIFICACION = '/icons/icon-192.png'

// Singleton a nivel de modulo (mismo criterio que apodoActual en
// useRoomNickname.ts): Notification.permission es del ORIGEN completo, no
// de una sala en particular - todas las instancias de este composable deben
// ver el mismo valor.
export const permiso = ref<NotificationPermission>(notificacionesSoportadas() ? Notification.permission : 'denied')

export function useChatNotifications() {
  const { t } = useLocale()
  const soportado = computed(() => notificacionesSoportadas())

  // Debe llamarse solo como reaccion directa a un click - varios navegadores
  // ignoran/bloquean requestPermission() si no corre dentro de la pila de un
  // gesto del usuario en curso.
  async function pedirPermiso() {
    if (!soportado.value) return
    permiso.value = await pedirPermisoNotificaciones()
  }

  // Unico punto de entrada real - se llama solo desde manejarMensajeEntrante
  // y manejarMediaPointer en useSecretChatRoom.ts (los dos unicos lugares
  // que manejan mensajes de otra persona, nunca los propios - broadcast.self
  // es false, ver ese archivo). A proposito no se llama desde agregar()/
  // useEphemeralMessages.ts, que corre por igual para mensajes propios y ajenos.
  function notificarMensajeRecibido(autor: string) {
    if (permiso.value !== 'granted') return
    if (!pestanaInactiva()) return
    mostrarNotificacionMensaje(t.value.chatNotificationTitle.replace('{apodo}', autor), ICONO_NOTIFICACION)
  }

  return { permiso, soportado, pedirPermiso, notificarMensajeRecibido }
}
