import { ref } from 'vue'

// Prefijo compartido con useCreateChat.ts (el creador precarga su propio
// apodo aca antes de mandar a alguien a su propio enlace). sessionStorage,
// nunca el backend ni Broadcast en texto plano: el apodo es un dato local
// de esta pestaña, se cifra recien al enviarse (ver useSecretChatRoom.ts).
export const NICKNAME_STORAGE_KEY_PREFIX = 's-rank-chat:nickname:'

const CLAVE_APODO_ACTUAL = 's-rank-chat:apodo-actual'

// Singleton a nivel de modulo (mismo criterio que locale en useLocale.ts):
// el apodo mas reciente elegido en esta pestaña, independiente de la sala -
// App.vue lo usa para el avatar decorativo del header, que no debe mostrarse
// hasta que la persona haya elegido un apodo por primera vez.
export const apodoActual = ref(sessionStorage.getItem(CLAVE_APODO_ACTUAL) ?? '')

export function recordarApodoActual(apodo: string) {
  apodoActual.value = apodo
  sessionStorage.setItem(CLAVE_APODO_ACTUAL, apodo)
}

export function useRoomNickname(roomId: string) {
  const claveStorage = `${NICKNAME_STORAGE_KEY_PREFIX}${roomId}`
  const apodo = ref(sessionStorage.getItem(claveStorage) ?? '')

  function guardar(nuevoApodo: string) {
    apodo.value = nuevoApodo
    sessionStorage.setItem(claveStorage, nuevoApodo)
    recordarApodoActual(nuevoApodo)
  }

  return { apodo, guardar }
}
