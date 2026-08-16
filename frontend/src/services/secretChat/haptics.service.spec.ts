import { afterEach, describe, expect, it, vi } from 'vitest'
import { PATRON_MENSAJE_ENVIADO, vibrar } from './haptics.service'

describe('haptics.service', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('llama a navigator.vibrate con el patron dado cuando la API existe', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })

    vibrar(PATRON_MENSAJE_ENVIADO)

    expect(vibrate).toHaveBeenCalledWith(PATRON_MENSAJE_ENVIADO)
  })

  it('no explota si el navegador no soporta la Vibration API (ej. iOS Safari)', () => {
    const { vibrate: _vibrate, ...navegadorSinVibrate } = navigator as Navigator & { vibrate?: unknown }
    vi.stubGlobal('navigator', navegadorSinVibrate)

    expect(() => vibrar(PATRON_MENSAJE_ENVIADO)).not.toThrow()
  })
})
