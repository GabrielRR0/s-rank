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
