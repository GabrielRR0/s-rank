import { onUnmounted, ref } from 'vue'

// Pointer events (no touch/mouse por separado) - un solo set de handlers
// cubre mouse, touch y stylus por igual. Sin precedente en el repo: es la
// primera vez que se necesita un gesto de mantener presionado.
export interface OpcionesLongPress {
  duracionMs?: number
  umbralMovimientoPx?: number
  onLongPress: (evento: PointerEvent) => void
}

const DURACION_DEFECTO_MS = 450
const UMBRAL_MOVIMIENTO_DEFECTO_PX = 10

export function useLongPress(opciones: OpcionesLongPress) {
  const activo = ref(false)
  let timeout: ReturnType<typeof setTimeout> | undefined
  let inicioX = 0
  let inicioY = 0

  function limpiar() {
    if (timeout) clearTimeout(timeout)
    timeout = undefined
    activo.value = false
  }

  // Al soltar el dedo/mouse despues de un long-press exitoso, el navegador
  // igual sintetiza un 'click' normal sobre el mismo elemento (mousedown+
  // mouseup sin mucho movimiento = click, sin importar que ya hayamos
  // actuado por pointerdown/timeout). Sin esto, ese click sintetico llega
  // al listener de "cerrar si se toca afuera" del menu que recien se abrio
  // (ver MessageActionBar.vue) y lo cierra al instante - la persona nunca
  // llega a ver ni tocar ninguna accion de adentro. Se intercepta en fase de
  // captura sobre el propio elemento presionado, una sola vez, antes de que
  // el evento pueda llegar a document.
  function suprimirProximoClick(elemento: EventTarget) {
    const interceptar = (evento: Event) => {
      evento.stopPropagation()
      elemento.removeEventListener('click', interceptar, true)
    }
    elemento.addEventListener('click', interceptar, true)
  }

  function onPointerDown(evento: PointerEvent) {
    inicioX = evento.clientX
    inicioY = evento.clientY
    activo.value = true
    const elemento = evento.currentTarget
    timeout = setTimeout(() => {
      // activo.value ya pudo pasar a false si hubo demasiado movimiento
      // (ver onPointerMove) o si se solto antes de tiempo (onPointerUp).
      if (activo.value) {
        opciones.onLongPress(evento)
        if (elemento) suprimirProximoClick(elemento)
      }
      limpiar()
    }, opciones.duracionMs ?? DURACION_DEFECTO_MS)
  }

  function onPointerMove(evento: PointerEvent) {
    if (!activo.value) return
    const distancia = Math.hypot(evento.clientX - inicioX, evento.clientY - inicioY)
    // Demasiado movimiento antes de que se cumpla el tiempo: la persona esta
    // scrolleando/arrastrando, no manteniendo presionado - se cancela.
    if (distancia > (opciones.umbralMovimientoPx ?? UMBRAL_MOVIMIENTO_DEFECTO_PX)) limpiar()
  }

  onUnmounted(limpiar)

  return { onPointerDown, onPointerMove, onPointerUp: limpiar, onPointerLeave: limpiar }
}
