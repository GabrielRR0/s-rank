import type { Locale } from '../../services/fileSharing/sharing.service'

const UN_DIA_MS = 24 * 60 * 60 * 1000

function inicioDelDia(timestampMs: number): number {
  const fecha = new Date(timestampMs)
  fecha.setHours(0, 0, 0, 0)
  return fecha.getTime()
}

// Funcion pura (sin DOM/reloj propio - `ahoraMs` se pasa como parametro,
// default a Date.now() solo para no obligar a cada llamador a pasarlo) -
// usada por MessageList.vue para decidir donde intercalar un separador de
// fecha entre mensajes.
export function sonMismoDia(aMs: number, bMs: number): boolean {
  return inicioDelDia(aMs) === inicioDelDia(bMs)
}

export function formatearSeparadorFecha(timestampMs: number, locale: Locale, ahoraMs: number = Date.now()): string {
  const diasDeDiferencia = Math.round((inicioDelDia(ahoraMs) - inicioDelDia(timestampMs)) / UN_DIA_MS)

  if (diasDeDiferencia === 0) return locale === 'es' ? 'Hoy' : 'Today'
  if (diasDeDiferencia === 1) return locale === 'es' ? 'Ayer' : 'Yesterday'

  // Año solo si es distinto al actual - "15 de agosto" alcanza para el año
  // en curso, mismo criterio que WhatsApp/Telegram.
  const mismoAño = new Date(timestampMs).getFullYear() === new Date(ahoraMs).getFullYear()
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: mismoAño ? undefined : 'numeric',
  }).format(new Date(timestampMs))
}
