<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

defineProps<{ titulo: string; cerrarAria: string }>()
const emit = defineEmits<{ cerrar: [] }>()

function manejarTecla(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cerrar')
}

onMounted(() => document.addEventListener('keydown', manejarTecla))
onUnmounted(() => document.removeEventListener('keydown', manejarTecla))
</script>

<template>
  <!-- Mismo patron que ConfirmModal.vue (Teleport + doble Transition,
       fondo/caja por separado) pero generico: cualquier formulario largo
       como contenido (ver VaultComposer.vue), no solo titulo+mensaje+2
       botones. En mobile pasa a ser un bottom sheet que se desliza desde
       abajo (ver @media abajo) - un modal centrado ahi se sentia fuera de
       lugar comparado con el resto de la app, que ya usa ese patron para
       el sidebar del chat. -->
  <Teleport to="body">
    <Transition name="modal-fondo" appear>
      <div class="fondo" @click.self="emit('cerrar')">
        <Transition name="modal-caja" appear>
          <div class="caja" role="dialog" aria-modal="true" :aria-label="titulo">
            <span class="agarradera" aria-hidden="true" />
            <div class="encabezado">
              <div class="titulo-grupo">
                <span v-if="$slots.icono" class="icono-titulo" aria-hidden="true"><slot name="icono" /></span>
                <p class="titulo">{{ titulo }}</p>
              </div>
              <button type="button" class="boton-cerrar" :aria-label="cerrarAria" @click="emit('cerrar')">
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    d="M5.28 4.22a.75.75 0 00-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 101.06 1.06L10 11.06l4.72 4.72a.75.75 0 101.06-1.06L11.06 10l4.72-4.72a.75.75 0 00-1.06-1.06L10 8.94 5.28 4.22z"
                  />
                </svg>
              </button>
            </div>
            <div class="contenido">
              <slot />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fondo {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: color-mix(in srgb, black 55%, transparent);
  backdrop-filter: blur(4px);
  z-index: 100;
}

.caja {
  width: 100%;
  max-width: 26rem;
  max-height: 85vh;
  overflow-y: auto;
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.agarradera {
  display: none;
}

.encabezado {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.titulo-grupo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.icono-titulo {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-surface));
  color: var(--accent);
}

.icono-titulo :deep(svg) {
  width: 0.9375rem;
  height: 0.9375rem;
}

.titulo {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-h);
}

.boton-cerrar {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.boton-cerrar:hover {
  color: var(--text-h);
  background: var(--bg-inset);
}

.boton-cerrar svg {
  width: 1.125rem;
  height: 1.125rem;
}

.contenido {
  min-height: 0;
}

.modal-fondo-enter-active,
.modal-fondo-leave-active {
  transition: opacity var(--duration-base) var(--ease-out);
}

.modal-fondo-enter-from,
.modal-fondo-leave-to {
  opacity: 0;
}

.modal-caja-enter-active,
.modal-caja-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.modal-caja-enter-from,
.modal-caja-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}

@media (max-width: 480px) {
  .fondo {
    align-items: flex-end;
    padding: 0;
  }

  .caja {
    max-width: 100%;
    max-height: 88vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
  }

  /* Barra decorativa arriba del todo - la señal visual estandar de "esto
     se puede deslizar/cerrar", aunque el gesto en si no esta implementado
     (cerrar es por el botón, tocar afuera, o Escape). */
  .agarradera {
    display: block;
    align-self: center;
    flex-shrink: 0;
    width: 2.25rem;
    height: 0.25rem;
    border-radius: 999px;
    background: var(--border);
    margin-bottom: 0.375rem;
  }

  .modal-caja-enter-from,
  .modal-caja-leave-to {
    transform: translateY(100%);
  }
}
</style>
