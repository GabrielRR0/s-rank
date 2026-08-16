// Wrapper stateless sobre la Vibration API - mismo espiritu que
// sound.service.ts/notification.service.ts. No hace nada en iOS Safari (no
// implementa la Vibration API en absoluto) - limitacion del navegador, no
// un bug a resolver aca.
export function vibrar(patron: number | number[]): void {
  if (!('vibrate' in navigator)) return
  navigator.vibrate(patron)
}

// Patrones con nombre para no repetir numeros magicos en cada punto de uso
// (MessageComposer.vue, useSecretChatRoom.ts, useVoiceRecorder.ts, useKickVote.ts).
export const PATRON_MENSAJE_ENVIADO = 15
export const PATRON_MENSAJE_RECIBIDO = [10, 40, 10]
export const PATRON_GRABACION_INICIO = 20
export const PATRON_GRABACION_FIN = 15
export const PATRON_VOTO_EMITIDO = 15
