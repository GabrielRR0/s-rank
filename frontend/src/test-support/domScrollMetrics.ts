// jsdom no implementa scrollHeight/clientHeight (siempre 0, solo lectura) ni
// scrollTop de forma significativa - sin esto, ningun test puede simular
// "el usuario esta cerca/lejos del fondo de la lista" (ver MessageList.vue).
// Mismo espiritu que fakeRealtimeChannel.ts: un doble de bajo nivel para
// testear logica que en el navegador real depende del layout.
export interface MetricasScroll {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

export function definirMetricasScroll(el: HTMLElement, metricas: MetricasScroll): void {
  Object.defineProperty(el, 'scrollHeight', { value: metricas.scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: metricas.clientHeight, configurable: true })
  Object.defineProperty(el, 'scrollTop', { value: metricas.scrollTop, configurable: true, writable: true })
}
