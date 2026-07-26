<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'

const { t } = useLocale()

const STORAGE_KEY = 'theme'
const esOscuro = ref(false)

function aplicarTema(oscuro: boolean) {
  document.documentElement.dataset.theme = oscuro ? 'dark' : 'light'
  esOscuro.value = oscuro
}

onMounted(() => {
  const guardado = localStorage.getItem(STORAGE_KEY)
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches
  aplicarTema(guardado ? guardado === 'dark' : prefiereOscuro)
})

function guardarYAplicar() {
  const nuevoOscuro = !esOscuro.value
  aplicarTema(nuevoOscuro)
  localStorage.setItem(STORAGE_KEY, nuevoOscuro ? 'dark' : 'light')
}

function alternar(evento: MouseEvent) {
  const prefiereReducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const soportaViewTransition = 'startViewTransition' in document

  if (!soportaViewTransition || prefiereReducirMovimiento) {
    guardarYAplicar()
    return
  }

  // El barrido circular nace desde el punto exacto donde se hizo click en el
  // toggle (no del centro de la pantalla), para que se sienta "originado"
  // por la accion del usuario.
  document.documentElement.style.setProperty('--theme-toggle-x', `${evento.clientX}px`)
  document.documentElement.style.setProperty('--theme-toggle-y', `${evento.clientY}px`)
  ;(document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(guardarYAplicar)
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :class="{ oscuro: esOscuro }"
    :aria-label="esOscuro ? t.themeToLight : t.themeToDark"
    @click="alternar"
  >
    <span class="icono sol" :class="{ activo: !esOscuro }">☀</span>
    <span class="icono luna" :class="{ activo: esOscuro }">☾</span>
    <span class="perilla" />
  </button>
</template>

<style scoped>
/* Los 3 elementos (sol, luna, perilla) son cuadrados de 1.375rem posicionados
   con el mismo inset de 2px desde cada borde del track - asi el icono activo
   queda matematicamente centrado sobre la perilla. */
.theme-toggle {
  position: relative;
  width: 3.25rem;
  height: 1.75rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  cursor: pointer;
  transition:
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.theme-toggle:active .perilla {
  transform: scale(0.88);
}

.theme-toggle.oscuro:active .perilla {
  transform: translateX(1.625rem) scale(0.88);
}

.icono {
  position: absolute;
  top: 2px;
  width: 1.375rem;
  height: 1.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  font-size: 0.75rem;
  line-height: 1;
  color: var(--text-muted);
  opacity: 0.5;
  transition:
    opacity var(--duration-base) var(--ease-out),
    color var(--duration-base) var(--ease-out);
}

.icono.sol {
  left: 2px;
}

.icono.luna {
  right: 2px;
}

.icono.activo {
  opacity: 1;
  color: var(--accent-contrast);
}

.perilla {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  background: var(--accent);
  transition:
    transform var(--duration-base) var(--ease-out),
    background-color var(--duration-base) var(--ease-out);
}

.theme-toggle.oscuro .perilla {
  transform: translateX(1.625rem);
}
</style>
