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
    <span class="icono sol" :class="{ activo: !esOscuro }">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M10 3a1 1 0 011 1v.5a1 1 0 11-2 0V4a1 1 0 011-1zm0 4a3 3 0 100 6 3 3 0 000-6zm7 3a1 1 0 01-1 1h-.5a1 1 0 110-2h.5a1 1 0 011 1zM4.5 9H4a1 1 0 100 2h.5a1 1 0 100-2zM10 15a1 1 0 011 1v.5a1 1 0 11-2 0V16a1 1 0 011-1zm5.66-9.66a1 1 0 00-1.42-1.42l-.35.35a1 1 0 001.42 1.42l.35-.35zM5.4 14.6a1 1 0 00-1.42 1.42l.35.35a1 1 0 001.42-1.42l-.35-.35zm9.9 0l-.35.35a1 1 0 001.42 1.42l.35-.35a1 1 0 10-1.42-1.42zM5.4 5.4L5.05 5.05a1 1 0 10-1.42 1.42l.35.35A1 1 0 005.4 5.4z"
        />
      </svg>
    </span>
    <span class="icono luna" :class="{ activo: esOscuro }">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
        />
      </svg>
    </span>
    <span class="perilla" />
  </button>
</template>

<style scoped>
/* Los 3 elementos (sol, luna, perilla) son cuadrados de 1.375rem posicionados
   con el mismo inset de 2px desde cada borde del track - asi el icono activo
   queda matematicamente centrado sobre la perilla. */
.theme-toggle {
  position: relative;
  width: 2.75rem;
  height: 1.5rem;
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
  transform: translateX(1.3125rem) scale(0.88);
}

.icono {
  position: absolute;
  top: 2px;
  width: 1.1875rem;
  height: 1.1875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  color: var(--text-muted);
  opacity: 0.5;
  transition:
    opacity var(--duration-base) var(--ease-out),
    color var(--duration-base) var(--ease-out);
}

.icono svg {
  width: 0.625rem;
  height: 0.625rem;
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
  width: 1.1875rem;
  height: 1.1875rem;
  border-radius: 50%;
  background: var(--accent-gradient);
  box-shadow: var(--shadow-glow-sm);
  transition:
    transform var(--duration-base) var(--ease-out),
    background-color var(--duration-base) var(--ease-out);
}

.theme-toggle.oscuro .perilla {
  transform: translateX(1.3125rem);
}
</style>
