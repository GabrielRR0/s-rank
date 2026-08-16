import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUnreadMessages } from './useUnreadMessages'

describe('useUnreadMessages', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...navigator,
      setAppBadge: vi.fn().mockResolvedValue(undefined),
      clearAppBadge: vi.fn().mockResolvedValue(undefined),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('empieza en cero', () => {
    const { noVistos } = useUnreadMessages()
    expect(noVistos.value).toBe(0)
  })

  it('marcarNoVisto incrementa el contador y actualiza el badge', () => {
    const { noVistos, marcarNoVisto } = useUnreadMessages()

    marcarNoVisto()
    marcarNoVisto()

    expect(noVistos.value).toBe(2)
    expect(navigator.setAppBadge).toHaveBeenLastCalledWith(2)
  })

  it('marcarTodoVisto resetea a cero y limpia el badge', () => {
    const { noVistos, marcarNoVisto, marcarTodoVisto } = useUnreadMessages()
    marcarNoVisto()
    marcarNoVisto()

    marcarTodoVisto()

    expect(noVistos.value).toBe(0)
    expect(navigator.clearAppBadge).toHaveBeenCalledOnce()
  })

  it('no explota si el navegador no soporta el Badge API', () => {
    vi.stubGlobal('navigator', { ...navigator, setAppBadge: undefined, clearAppBadge: undefined })
    const { noVistos, marcarNoVisto, marcarTodoVisto } = useUnreadMessages()

    expect(() => {
      marcarNoVisto()
      marcarTodoVisto()
    }).not.toThrow()
    expect(noVistos.value).toBe(0)
  })
})
