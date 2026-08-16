// jsdom no implementa matchMedia - lo necesitan ThemeToggle.vue y
// useInstallPrompt.ts (este ultimo lo llama a nivel de modulo, al
// importarse, asi que sin este polyfill global cualquier test que toque
// esos archivos falla antes de llegar a su propio beforeEach).
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// Tampoco implementa Vibration API, Web Share API ni Badge API - las usan
// haptics.service.ts, share.service.ts y useUnreadMessages.ts
// respectivamente. Polyfills no-op guardados, mismo criterio que matchMedia
// arriba - los tests que quieren verificar la llamada en si stubbean estos
// mismos metodos con vi.stubGlobal/vi.fn() por su cuenta.
if (!navigator.vibrate) {
  navigator.vibrate = () => true
}

if (!navigator.share) {
  navigator.share = async () => {}
}

if (!navigator.setAppBadge) {
  navigator.setAppBadge = async () => {}
}

if (!navigator.clearAppBadge) {
  navigator.clearAppBadge = async () => {}
}
