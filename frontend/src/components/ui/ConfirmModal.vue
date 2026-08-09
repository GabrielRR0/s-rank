<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ titulo: string; mensaje: string; textoAceptar: string; textoCancelar: string }>()
const emit = defineEmits<{ aceptar: []; cancelar: [] }>()

const botonAceptar = ref<HTMLButtonElement | null>(null)

function manejarTecla(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cancelar')
}

onMounted(() => {
  document.addEventListener('keydown', manejarTecla)
  botonAceptar.value?.focus()
})

onUnmounted(() => {
  document.removeEventListener('keydown', manejarTecla)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fondo" appear>
      <div class="fondo" @click.self="emit('cancelar')">
        <Transition name="modal-caja" appear>
          <div class="caja" role="dialog" aria-modal="true" :aria-label="titulo">
            <p class="titulo">{{ titulo }}</p>
            <p class="mensaje">{{ mensaje }}</p>
            <div class="acciones">
              <button type="button" class="boton-cancelar" @click="emit('cancelar')">{{ textoCancelar }}</button>
              <button ref="botonAceptar" type="button" class="boton-aceptar" @click="emit('aceptar')">
                {{ textoAceptar }}
              </button>
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
  z-index: 100;
}

.caja {
  width: 100%;
  max-width: 22rem;
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.titulo {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-h);
}

.mensaje {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.acciones {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.boton-cancelar {
  border: none;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
}

.boton-cancelar:hover {
  color: var(--text);
}

.boton-aceptar {
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-contrast);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.boton-aceptar:hover {
  opacity: 0.88;
}

.modal-fondo-enter-active,
.modal-fondo-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.modal-fondo-enter-from,
.modal-fondo-leave-to {
  opacity: 0;
}

.modal-caja-enter-active,
.modal-caja-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
}

.modal-caja-enter-from,
.modal-caja-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}
</style>
