// Envoltorio delgado sobre la Notification API del navegador - mismo
// criterio que sound.service.ts: sin estado ni dependencias de Vue/i18n,
// solo funciones que hablan directo con el navegador.

export function notificacionesSoportadas(): boolean {
  return typeof Notification !== 'undefined'
}

export async function pedirPermisoNotificaciones(): Promise<NotificationPermission> {
  if (!notificacionesSoportadas()) return 'denied'
  return Notification.requestPermission()
}

// OR, no AND: cubre tanto "pestaña en segundo plano" (visibilityState)
// como "pestaña visible pero la ventana del navegador perdio el foco del
// SO" (hasFocus) - dos formas distintas de "no la esta mirando ahora
// mismo". Falso positivo aceptado (ej. foco en la barra de direcciones con
// la pestaña igual visible): la notificacion nunca lleva contenido
// sensible, mejor un aviso de mas que quedarse corto en un backgrounding real.
export function pestanaInactiva(): boolean {
  return document.visibilityState === 'hidden' || !document.hasFocus()
}

export function mostrarNotificacionMensaje(titulo: string, iconoUrl: string): void {
  const notificacion = new Notification(titulo, {
    icon: iconoUrl,
    // Mismo tag para todas: la siguiente reemplaza a la anterior en vez de
    // apilarse - quien vuelve ve un solo aviso con el ultimo remitente, no
    // una torre de notificaciones (la cantidad en si tambien es info a no
    // exponer de mas).
    tag: 'nuevo-mensaje',
  })
  notificacion.onclick = () => {
    window.focus()
    notificacion.close()
  }
}
