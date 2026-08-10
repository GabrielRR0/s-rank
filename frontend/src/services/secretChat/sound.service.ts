// Sonido sintetizado con Web Audio API (ruido blanco filtrado, sin archivo
// de audio externo) - mismo criterio que crypto.service.ts: sin assets ni
// dependencias nuevas para algo que el navegador ya puede generar. Se
// dispara al registrar un mensaje (propio o recibido, ver useEphemeralMessages.ts).
import { getAudioContext } from '../audioContext.service'

const DURACION_SEGUNDOS = 0.5
// Pico de volumen bajo a proposito - un "soplido" apenas perceptible, no
// una notificacion sonora tradicional.
const VOLUMEN_PICO = 0.05

export function reproducirSonidoMensaje(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  // Los navegadores suspenden el AudioContext hasta el primer gesto del
  // usuario en la pagina - para cuando esto se llama (enviar/recibir un
  // mensaje dentro de una sala) siempre hubo ya al menos un click
  // (crear/entrar a la sala), asi que resume() no deberia quedar pendiente.
  if (ctx.state === 'suspended') void ctx.resume()

  const sampleRate = ctx.sampleRate
  const bufferSize = Math.floor(sampleRate * DURACION_SEGUNDOS)
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate)
  const datos = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    datos[i] = Math.random() * 2 - 1
  }

  const fuente = ctx.createBufferSource()
  fuente.buffer = buffer

  // Filtro pasa-banda que barre de agudo a grave: le da al ruido blanco el
  // caracter de "soplido de viento" en vez de sonar como estatica.
  const filtro = ctx.createBiquadFilter()
  filtro.type = 'bandpass'
  filtro.Q.value = 0.7
  filtro.frequency.setValueAtTime(2200, ctx.currentTime)
  filtro.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + DURACION_SEGUNDOS)

  // Entra rapido y se apaga suave (ramp exponencial, mas natural al oido
  // que uno lineal para un fade-out).
  const ganancia = ctx.createGain()
  ganancia.gain.setValueAtTime(0, ctx.currentTime)
  ganancia.gain.linearRampToValueAtTime(VOLUMEN_PICO, ctx.currentTime + 0.04)
  ganancia.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + DURACION_SEGUNDOS)

  fuente.connect(filtro)
  filtro.connect(ganancia)
  ganancia.connect(ctx.destination)

  fuente.start()
  fuente.stop(ctx.currentTime + DURACION_SEGUNDOS)
}
