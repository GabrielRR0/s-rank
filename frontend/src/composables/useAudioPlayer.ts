import { onUnmounted, ref } from 'vue'
import { getAudioContext } from '../services/audioContext.service'

// Reproductor propio sobre la Web Audio API: a diferencia de un <audio
// src="...">, nunca hay una URL de archivo en el DOM que un click derecho
// pueda ofrecer "Guardar como", ni un boton nativo de descarga - es friccion
// deliberada (ver secretChat/README.md y fileSharing/README.md), no una
// garantia criptografica. Sin carpeta de dominio: lo usan tanto secretChat
// como fileSharing (mismo criterio que composables/useTurnstile.ts).
export function useAudioPlayer(datos: ArrayBuffer) {
  const reproduciendo = ref(false)
  const posicionSegundos = ref(0)
  const duracionSegundos = ref(0)
  const error = ref(false)

  let audioBuffer: AudioBuffer | null = null
  let nodoFuente: AudioBufferSourceNode | null = null
  // AudioBufferSourceNode solo admite start() una vez - pausar/reanudar se
  // simula guardando cuanto se llevaba reproducido (offset) y desde que
  // momento del reloj del AudioContext arranco el nodo actual.
  let offset = 0
  let tiempoInicio = 0
  let cuadro: number | undefined

  const listo = (async () => {
    const ctx = getAudioContext()
    if (!ctx) {
      error.value = true
      return
    }
    try {
      audioBuffer = await ctx.decodeAudioData(datos.slice(0))
      duracionSegundos.value = audioBuffer.duration
    } catch {
      error.value = true
    }
  })()

  function detener() {
    if (nodoFuente) {
      try {
        nodoFuente.stop()
      } catch {
        // ya estaba detenido - nada que hacer
      }
      nodoFuente.disconnect()
      nodoFuente = null
    }
    if (cuadro !== undefined) cancelAnimationFrame(cuadro)
    reproduciendo.value = false
  }

  function actualizarProgreso() {
    const ctx = getAudioContext()
    if (!ctx) return
    posicionSegundos.value = Math.min(offset + (ctx.currentTime - tiempoInicio), duracionSegundos.value)
    if (posicionSegundos.value >= duracionSegundos.value) {
      detener()
      posicionSegundos.value = 0
      offset = 0
      return
    }
    cuadro = requestAnimationFrame(actualizarProgreso)
  }

  function reproducirDesde(inicioSegundos: number) {
    const ctx = getAudioContext()
    if (!ctx || !audioBuffer) return
    if (ctx.state === 'suspended') void ctx.resume()
    detener()
    nodoFuente = ctx.createBufferSource()
    nodoFuente.buffer = audioBuffer
    nodoFuente.connect(ctx.destination)
    offset = inicioSegundos
    tiempoInicio = ctx.currentTime
    nodoFuente.start(0, inicioSegundos)
    reproduciendo.value = true
    cuadro = requestAnimationFrame(actualizarProgreso)
  }

  async function alternar() {
    await listo
    if (error.value || !audioBuffer) return
    if (reproduciendo.value) {
      const ctx = getAudioContext()
      if (ctx) offset = offset + (ctx.currentTime - tiempoInicio)
      detener()
    } else {
      reproducirDesde(posicionSegundos.value >= duracionSegundos.value ? 0 : posicionSegundos.value)
    }
  }

  function buscar(fraccion: number) {
    const nuevaPosicion = Math.max(0, Math.min(1, fraccion)) * duracionSegundos.value
    posicionSegundos.value = nuevaPosicion
    offset = nuevaPosicion
    if (reproduciendo.value) reproducirDesde(nuevaPosicion)
  }

  onUnmounted(detener)

  return { reproduciendo, posicionSegundos, duracionSegundos, error, alternar, buscar }
}
