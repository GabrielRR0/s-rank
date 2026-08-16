import { ref } from 'vue'

// Arrastre de un solo eje (horizontal) via pointer events - usado por el
// sidebar del chat (cerrar deslizando) y por las burbujas de mensaje
// (responder deslizando). Sin precedente en el repo: primer gesto de drag.
export interface OpcionesSwipeGesture {
  direccion: 'izquierda' | 'derecha'
  umbralPx?: number
  onArrastrar?: (deltaPx: number) => void
  onCommit: () => void
  onCancelar?: () => void
}

const UMBRAL_DEFECTO_PX = 80

export function useSwipeGesture(opciones: OpcionesSwipeGesture) {
  const arrastrando = ref(false)
  const deltaX = ref(0)
  let inicioX = 0
  let activo = false

  function vaEnDireccionEsperada(delta: number): boolean {
    return opciones.direccion === 'izquierda' ? delta < 0 : delta > 0
  }

  function onPointerDown(evento: PointerEvent) {
    inicioX = evento.clientX
    activo = true
    arrastrando.value = true
    deltaX.value = 0
  }

  function onPointerMove(evento: PointerEvent) {
    if (!activo) return
    const delta = evento.clientX - inicioX
    // En la direccion contraria a la configurada no se sigue el arrastre -
    // deltaX se mantiene en 0 en vez de ir negativo/positivo al reves.
    deltaX.value = vaEnDireccionEsperada(delta) ? delta : 0
    opciones.onArrastrar?.(deltaX.value)
  }

  function finalizar() {
    if (!activo) return
    activo = false
    arrastrando.value = false
    const umbral = opciones.umbralPx ?? UMBRAL_DEFECTO_PX
    if (Math.abs(deltaX.value) >= umbral) {
      opciones.onCommit()
    } else {
      opciones.onCancelar?.()
    }
    deltaX.value = 0
  }

  return { arrastrando, deltaX, onPointerDown, onPointerMove, onPointerUp: finalizar, onPointerLeave: finalizar }
}
