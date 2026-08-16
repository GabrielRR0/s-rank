import { onUnmounted, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { PATRON_GRABACION_FIN, PATRON_GRABACION_INICIO, vibrar } from '../../services/secretChat/haptics.service'

export interface AudioGrabado {
  datos: ArrayBuffer
  mimeType: string
}

// 60s: el TTL mas largo que puede tener una sala (TTL_OPCIONES_SEGUNDOS en
// useCreateChat.ts) - asi hasta una grabacion al limite es teoricamente
// escuchable completa antes de que el mensaje se autodestruya en el peor
// caso. Salas con TTL mas corto igual pueden hacer que un audio desaparezca
// antes de terminar de reproducirse - consecuencia aceptada del mismo TTL
// para todo tipo de mensaje, no un bug a resolver pausando la cuenta
// regresiva (eso rompería la garantia de autodestruccion).
const DURACION_MAXIMA_SEGUNDOS = 60

export function useVoiceRecorder() {
  const { t } = useLocale()
  const grabando = ref(false)
  const duracionSegundos = ref(0)
  const error = ref('')

  let mediaRecorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let intervalo: ReturnType<typeof setInterval> | undefined

  function detenerPistas() {
    mediaRecorder?.stream.getTracks().forEach((track) => track.stop())
  }

  function limpiarIntervalo() {
    if (intervalo) clearInterval(intervalo)
    intervalo = undefined
  }

  async function iniciar() {
    error.value = ''
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []
      mediaRecorder = new MediaRecorder(stream)
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      mediaRecorder.start()
      grabando.value = true
      duracionSegundos.value = 0
      vibrar(PATRON_GRABACION_INICIO)
      intervalo = setInterval(() => {
        duracionSegundos.value += 1
        if (duracionSegundos.value >= DURACION_MAXIMA_SEGUNDOS) detener()
      }, 1000)
    } catch {
      error.value = t.value.errorMicAccessFailed
    }
  }

  function detener(): Promise<AudioGrabado | null> {
    return new Promise((resolve) => {
      if (!mediaRecorder || !grabando.value) {
        resolve(null)
        return
      }
      const mimeType = mediaRecorder.mimeType || 'audio/webm'
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType })
        detenerPistas()
        resolve({ datos: await blob.arrayBuffer(), mimeType })
      }
      mediaRecorder.stop()
      grabando.value = false
      limpiarIntervalo()
      vibrar(PATRON_GRABACION_FIN)
    })
  }

  function cancelar() {
    if (mediaRecorder && grabando.value) {
      mediaRecorder.onstop = null
      mediaRecorder.stop()
      detenerPistas()
    }
    grabando.value = false
    limpiarIntervalo()
  }

  onUnmounted(cancelar)

  return { grabando, duracionSegundos, error, iniciar, detener, cancelar }
}
