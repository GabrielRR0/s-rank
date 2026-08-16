// Sonido sintetizado con Web Audio API (sin archivo de audio externo) -
// mismo criterio que crypto.service.ts: sin assets ni dependencias nuevas
// para algo que el navegador ya puede generar. Se dispara al registrar un
// mensaje (propio o recibido, ver useEphemeralMessages.ts).
import { getAudioContext } from '../audioContext.service'

// Dos notas cortas ascendientes (cuarta justa, F#5 -> B5) en vez del soplido
// de ruido anterior - un "pop" tipo campanita, mas reconocible como "llego
// un mensaje" sin ser un timbre tradicional estridente.
const NOTA_1_HZ = 740
const NOTA_2_HZ = 988
const RETRASO_NOTA_2_SEGUNDOS = 0.085
const DURACION_NOTA_SEGUNDOS = 0.22
const ATAQUE_SEGUNDOS = 0.004

function reproducirNota(ctx: AudioContext, frecuencia: number, inicioEn: number, volumenPico: number): void {
  const oscilador = ctx.createOscillator()
  oscilador.type = 'triangle'
  oscilador.frequency.value = frecuencia

  // Pasa-bajos suave: le saca filo a los armonicos de la onda triangular,
  // para que la nota suene redonda/calida en vez de aguda o metalica.
  const filtro = ctx.createBiquadFilter()
  filtro.type = 'lowpass'
  filtro.frequency.value = 3200
  filtro.Q.value = 0.6

  const ganancia = ctx.createGain()
  ganancia.gain.setValueAtTime(0, inicioEn)
  ganancia.gain.linearRampToValueAtTime(volumenPico, inicioEn + ATAQUE_SEGUNDOS)
  ganancia.gain.exponentialRampToValueAtTime(0.0001, inicioEn + DURACION_NOTA_SEGUNDOS)

  oscilador.connect(filtro)
  filtro.connect(ganancia)
  ganancia.connect(ctx.destination)

  oscilador.start(inicioEn)
  oscilador.stop(inicioEn + DURACION_NOTA_SEGUNDOS)
}

export function reproducirSonidoMensaje(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  // Los navegadores suspenden el AudioContext hasta el primer gesto del
  // usuario en la pagina - para cuando esto se llama (enviar/recibir un
  // mensaje dentro de una sala) siempre hubo ya al menos un click
  // (crear/entrar a la sala), asi que resume() no deberia quedar pendiente.
  if (ctx.state === 'suspended') void ctx.resume()

  reproducirNota(ctx, NOTA_1_HZ, ctx.currentTime, 0.16)
  reproducirNota(ctx, NOTA_2_HZ, ctx.currentTime + RETRASO_NOTA_2_SEGUNDOS, 0.14)
}
