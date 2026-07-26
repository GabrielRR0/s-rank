import { computed, ref, watch } from 'vue'
import type { Locale } from '../services/fileSharing/sharing.service'
import { translations } from './translations'

const STORAGE_KEY = 'locale'

function detectarLocaleInicial(): Locale {
  const guardado = localStorage.getItem(STORAGE_KEY)
  if (guardado === 'es' || guardado === 'en') return guardado
  // Primera visita: seguir el idioma del navegador, español por defecto
  // para cualquier otro idioma (no solo ingles/espanol).
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es'
}

// Singleton a nivel de modulo: un solo estado de idioma compartido por toda
// la app (no tiene sentido que cada componente tenga el suyo).
const locale = ref<Locale>(detectarLocaleInicial())

watch(
  locale,
  (nuevo) => {
    localStorage.setItem(STORAGE_KEY, nuevo)
    document.documentElement.lang = nuevo
    document.title = translations[nuevo].appTitle
  },
  { immediate: true },
)

export function useLocale() {
  const t = computed(() => translations[locale.value])

  function alternarLocale() {
    locale.value = locale.value === 'es' ? 'en' : 'es'
  }

  return { locale, t, alternarLocale }
}
