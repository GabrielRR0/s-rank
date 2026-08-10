<script setup lang="ts">
withDefaults(defineProps<{ disabled?: boolean; variant?: 'primary' | 'secondary'; size?: 'md' | 'sm' }>(), {
  variant: 'primary',
  size: 'md',
})
defineEmits<{ click: [] }>()
</script>

<template>
  <button class="base-button" :class="[variant, size]" :disabled="disabled" @click="$emit('click')">
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  padding: 0.75rem 1.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out),
    color var(--duration-base) var(--ease-out);
}

/* Para botones metidos dentro de un contexto ya compacto (la Capsula
   dentro del composer del chat, por ejemplo) - los CTA principales de
   pantalla completa (Crear enlace, Crear sala) siguen usando el tamaño
   por defecto ("md"), sin tocar. */
.base-button.sm {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
}

.base-button.primary {
  border: none;
  background: var(--accent-gradient);
  box-shadow: var(--shadow-glow);
  color: var(--accent-contrast);
}

.base-button.secondary {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-h);
}

.base-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.base-button:not(:disabled):hover {
  opacity: 0.88;
}

.base-button:not(:disabled):active {
  transform: scale(0.97);
}
</style>
