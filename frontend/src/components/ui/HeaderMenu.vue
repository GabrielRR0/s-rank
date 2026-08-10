<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import LanguageToggle from './LanguageToggle.vue'
import ThemeToggle from './ThemeToggle.vue'

// mostrarSalir: solo tiene sentido salir de "la sala" estando en una - fuera
// de un chat activo no hay nada de donde salir (ver App.vue, se pasa
// !!chatRoomId).
defineProps<{ mostrarSalir: boolean }>()
const emit = defineEmits<{ salir: [] }>()

const { t } = useLocale()
const abierto = ref(false)
const raiz = ref<HTMLElement | null>(null)

function alternar() {
  abierto.value = !abierto.value
}

function manejarClickAfuera(event: MouseEvent) {
  if (abierto.value && raiz.value && !raiz.value.contains(event.target as Node)) {
    abierto.value = false
  }
}

function manejarTecla(event: KeyboardEvent) {
  if (event.key === 'Escape') abierto.value = false
}

onMounted(() => {
  document.addEventListener('click', manejarClickAfuera)
  document.addEventListener('keydown', manejarTecla)
})

onUnmounted(() => {
  document.removeEventListener('click', manejarClickAfuera)
  document.removeEventListener('keydown', manejarTecla)
})
</script>

<template>
  <div ref="raiz" class="header-menu">
    <button
      type="button"
      class="boton-trigger"
      :aria-label="t.headerMenuAria"
      :aria-expanded="abierto"
      @click="alternar"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 6a2 2 0 100-4 2 2 0 000 4zM10 12a2 2 0 100-4 2 2 0 000 4zM10 18a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
    </button>

    <Transition name="menu-caida">
      <div v-if="abierto" class="panel" role="menu">
        <div class="fila-control">
          <span class="etiqueta">{{ t.headerMenuLanguage }}</span>
          <LanguageToggle />
        </div>
        <div class="fila-control">
          <span class="etiqueta">{{ t.headerMenuTheme }}</span>
          <ThemeToggle />
        </div>
        <template v-if="mostrarSalir">
          <span class="separador" />
          <button type="button" class="item-salir" role="menuitem" @click="emit('salir')">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                clip-rule="evenodd"
              />
              <path
                fill-rule="evenodd"
                d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z"
                clip-rule="evenodd"
              />
            </svg>
            {{ t.headerMenuLeaveRoom }}
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.header-menu {
  position: relative;
  display: inline-flex;
}

.boton-trigger {
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-inset);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.boton-trigger svg {
  width: 1rem;
  height: 1rem;
}

.boton-trigger:hover,
.boton-trigger[aria-expanded='true'] {
  color: var(--text-h);
  border-color: var(--accent);
}

.panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 30;
  width: 12rem;
  padding: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
}

.fila-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.etiqueta {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.separador {
  height: 1px;
  background: var(--border);
}

.item-salir {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  background: none;
  color: var(--alert-text);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.375rem 0;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.item-salir svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.item-salir:hover {
  opacity: 0.8;
}

.menu-caida-enter-active,
.menu-caida-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.menu-caida-enter-from,
.menu-caida-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
</style>
