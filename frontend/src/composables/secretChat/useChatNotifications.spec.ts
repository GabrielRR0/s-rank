import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocale } from '../../i18n/useLocale'
import { permiso, useChatNotifications } from './useChatNotifications'

class NotificacionSimulada {
  static instancias: NotificacionSimulada[] = []
  titulo: string
  opciones?: NotificationOptions
  onclick: (() => void) | null = null
  close = vi.fn()

  constructor(titulo: string, opciones?: NotificationOptions) {
    this.titulo = titulo
    this.opciones = opciones
    NotificacionSimulada.instancias.push(this)
  }
}

describe('useChatNotifications', () => {
  beforeEach(() => {
    useLocale().locale.value = 'es'
    permiso.value = 'default'
    NotificacionSimulada.instancias = []
    vi.stubGlobal('Notification', NotificacionSimulada)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('no notifica si el permiso todavia no fue otorgado', () => {
    permiso.value = 'default'
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

    useChatNotifications().notificarMensajeRecibido('Ana')

    expect(NotificacionSimulada.instancias).toHaveLength(0)
  })

  it('no notifica si la pestana sigue activa (visible y con foco), aunque el permiso este otorgado', () => {
    permiso.value = 'granted'
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)

    useChatNotifications().notificarMensajeRecibido('Ana')

    expect(NotificacionSimulada.instancias).toHaveLength(0)
  })

  it('notifica con el apodo del remitente, sin contenido del mensaje, cuando la pestana esta en segundo plano', () => {
    permiso.value = 'granted'
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

    useChatNotifications().notificarMensajeRecibido('Ana')

    expect(NotificacionSimulada.instancias).toHaveLength(1)
    expect(NotificacionSimulada.instancias[0].titulo).toBe('Ana envió un mensaje')
  })

  it('tambien notifica si la pestana esta visible pero la ventana perdio el foco del SO', () => {
    permiso.value = 'granted'
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)

    useChatNotifications().notificarMensajeRecibido('Beto')

    expect(NotificacionSimulada.instancias).toHaveLength(1)
  })

  it('pedirPermiso() actualiza el singleton compartido con el resultado del navegador', async () => {
    ;(Notification as unknown as { requestPermission: () => Promise<NotificationPermission> }).requestPermission =
      vi.fn().mockResolvedValue('granted')

    await useChatNotifications().pedirPermiso()

    expect(permiso.value).toBe('granted')
  })
})
