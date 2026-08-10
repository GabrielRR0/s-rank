// AudioContext perezoso y compartido por toda la app - lo usan
// secretChat/sound.service.ts (sonido de notificacion) y useAudioPlayer.ts
// (reproduccion real de audio, chat y fileSharing). Un unico AudioContext
// por pestaña: los navegadores limitan cuantos se pueden crear y no hay
// motivo para tener mas de uno.
let audioCtx: AudioContext | null | undefined

export function getAudioContext(): AudioContext | null {
  if (audioCtx !== undefined) return audioCtx
  const Constructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  audioCtx = Constructor ? new Constructor() : null
  return audioCtx
}
