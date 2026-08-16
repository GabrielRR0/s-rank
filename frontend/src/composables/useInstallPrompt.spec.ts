import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eventoDiferido, instalada, useInstallPrompt } from './useInstallPrompt'

function dispararBeforeInstallPrompt(prompt = vi.fn().mockResolvedValue(undefined), outcome: 'accepted' | 'dismissed' = 'accepted') {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  }
  evento.prompt = prompt
  evento.userChoice = Promise.resolve({ outcome, platform: 'web' })
  window.dispatchEvent(evento)
  return evento
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    eventoDiferido.value = null
    instalada.value = false
  })

  it('no esta disponible hasta que el navegador dispara beforeinstallprompt', () => {
    const { disponible } = useInstallPrompt()
    expect(disponible.value).toBe(false)
  })

  it('queda disponible despues de beforeinstallprompt, y previene el mini-infobar por defecto del navegador', () => {
    const evento = dispararBeforeInstallPrompt()
    const { disponible } = useInstallPrompt()

    expect(disponible.value).toBe(true)
    expect(evento.defaultPrevented).toBe(true)
  })

  it('instalar() dispara el prompt diferido y marca instalada al aceptar', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    dispararBeforeInstallPrompt(prompt, 'accepted')

    const { instalar, instalada, disponible } = useInstallPrompt()
    await instalar()

    expect(prompt).toHaveBeenCalledOnce()
    expect(instalada.value).toBe(true)
    expect(disponible.value).toBe(false)
  })

  it('appinstalled marca instalada aunque no haya pasado por instalar()', () => {
    window.dispatchEvent(new Event('appinstalled'))

    const { instalada, disponible } = useInstallPrompt()
    expect(instalada.value).toBe(true)
    expect(disponible.value).toBe(false)
  })
})
