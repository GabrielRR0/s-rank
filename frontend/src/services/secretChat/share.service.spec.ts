import { afterEach, describe, expect, it, vi } from 'vitest'
import * as clipboard from '../../composables/useClipboard'
import { compartirEnlace } from './share.service'

describe('share.service', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('usa navigator.share cuando esta disponible', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share })

    const resultado = await compartirEnlace('https://s-rank.app/chat/1', 'S-Rank')

    expect(share).toHaveBeenCalledWith({ url: 'https://s-rank.app/chat/1', title: 'S-Rank' })
    expect(resultado).toBe('compartido')
  })

  it('cae al portapapeles si navigator.share no existe', async () => {
    const { share: _share, ...navegadorSinShare } = navigator as Navigator & { share?: unknown }
    vi.stubGlobal('navigator', navegadorSinShare)
    vi.spyOn(clipboard, 'copiarAlPortapapeles').mockResolvedValue(true)

    const resultado = await compartirEnlace('https://s-rank.app/chat/1', 'S-Rank')

    expect(clipboard.copiarAlPortapapeles).toHaveBeenCalledWith('https://s-rank.app/chat/1')
    expect(resultado).toBe('copiado')
  })

  it('no trata la cancelacion del usuario (AbortError) como un error', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('cancelado'), { name: 'AbortError' }))
    vi.stubGlobal('navigator', { ...navigator, share })

    const resultado = await compartirEnlace('https://s-rank.app/chat/1', 'S-Rank')

    expect(resultado).toBe('cancelado')
  })
})
