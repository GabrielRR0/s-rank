import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from './useLongPress'

function pointerEvento(x: number, y = 0): PointerEvent {
  return { clientX: x, clientY: y } as PointerEvent
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispara onLongPress al mantener presionado el tiempo configurado', () => {
    const onLongPress = vi.fn()
    const { onPointerDown } = useLongPress({ duracionMs: 450, onLongPress })

    onPointerDown(pointerEvento(10))
    vi.advanceTimersByTime(450)

    expect(onLongPress).toHaveBeenCalledOnce()
  })

  it('no dispara si se suelta antes de tiempo', () => {
    const onLongPress = vi.fn()
    const { onPointerDown, onPointerUp } = useLongPress({ duracionMs: 450, onLongPress })

    onPointerDown(pointerEvento(10))
    vi.advanceTimersByTime(200)
    onPointerUp()
    vi.advanceTimersByTime(300)

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('no dispara si hay demasiado movimiento antes de tiempo (se interpreta como scroll/drag)', () => {
    const onLongPress = vi.fn()
    const { onPointerDown, onPointerMove } = useLongPress({ duracionMs: 450, umbralMovimientoPx: 10, onLongPress })

    onPointerDown(pointerEvento(10))
    onPointerMove(pointerEvento(30))
    vi.advanceTimersByTime(450)

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('tolera movimiento pequeño dentro del umbral', () => {
    const onLongPress = vi.fn()
    const { onPointerDown, onPointerMove } = useLongPress({ duracionMs: 450, umbralMovimientoPx: 10, onLongPress })

    onPointerDown(pointerEvento(10))
    onPointerMove(pointerEvento(14))
    vi.advanceTimersByTime(450)

    expect(onLongPress).toHaveBeenCalledOnce()
  })

  it('suprime el click sintetico que sigue al long-press (sin esto, cierra de inmediato cualquier menu que se haya abierto por click-afuera)', () => {
    const contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    const { onPointerDown } = useLongPress({ duracionMs: 450, onLongPress: vi.fn() })
    contenedor.addEventListener('pointerdown', onPointerDown)

    contenedor.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, bubbles: true }))
    vi.advanceTimersByTime(450)

    const clickEnDocumento = vi.fn()
    document.addEventListener('click', clickEnDocumento)
    // El navegador real sintetiza este click al soltar - se simula tal cual.
    contenedor.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(clickEnDocumento).not.toHaveBeenCalled()

    document.removeEventListener('click', clickEnDocumento)
    contenedor.remove()
  })

  it('un click normal (sin long-press previo) no se suprime', () => {
    const contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    useLongPress({ duracionMs: 450, onLongPress: vi.fn() })

    const clickEnDocumento = vi.fn()
    document.addEventListener('click', clickEnDocumento)
    contenedor.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(clickEnDocumento).toHaveBeenCalledOnce()

    document.removeEventListener('click', clickEnDocumento)
    contenedor.remove()
  })
})
