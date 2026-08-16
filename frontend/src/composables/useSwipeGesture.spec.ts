import { describe, expect, it, vi } from 'vitest'
import { useSwipeGesture } from './useSwipeGesture'

function pointerEvento(x: number): PointerEvent {
  return { clientX: x } as PointerEvent
}

describe('useSwipeGesture', () => {
  it('confirma el gesto al arrastrar pasado el umbral en la direccion configurada', () => {
    const onCommit = vi.fn()
    const onCancelar = vi.fn()
    const { onPointerDown, onPointerMove, onPointerUp } = useSwipeGesture({
      direccion: 'izquierda',
      umbralPx: 80,
      onCommit,
      onCancelar,
    })

    onPointerDown(pointerEvento(200))
    onPointerMove(pointerEvento(100))
    onPointerUp()

    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCancelar).not.toHaveBeenCalled()
  })

  it('cancela si no se llega al umbral', () => {
    const onCommit = vi.fn()
    const onCancelar = vi.fn()
    const { onPointerDown, onPointerMove, onPointerUp } = useSwipeGesture({
      direccion: 'izquierda',
      umbralPx: 80,
      onCommit,
      onCancelar,
    })

    onPointerDown(pointerEvento(200))
    onPointerMove(pointerEvento(150))
    onPointerUp()

    expect(onCommit).not.toHaveBeenCalled()
    expect(onCancelar).toHaveBeenCalledOnce()
  })

  it('ignora el arrastre en la direccion contraria a la configurada', () => {
    const onArrastrar = vi.fn()
    const { onPointerDown, onPointerMove } = useSwipeGesture({
      direccion: 'izquierda',
      onArrastrar,
      onCommit: vi.fn(),
    })

    onPointerDown(pointerEvento(100))
    onPointerMove(pointerEvento(180)) // hacia la derecha, direccion configurada es izquierda

    expect(onArrastrar).toHaveBeenCalledWith(0)
  })

  it('reporta el delta en vivo mientras se arrastra en la direccion correcta', () => {
    const onArrastrar = vi.fn()
    const { onPointerDown, onPointerMove } = useSwipeGesture({
      direccion: 'derecha',
      onArrastrar,
      onCommit: vi.fn(),
    })

    onPointerDown(pointerEvento(100))
    onPointerMove(pointerEvento(140))

    expect(onArrastrar).toHaveBeenCalledWith(40)
  })
})
