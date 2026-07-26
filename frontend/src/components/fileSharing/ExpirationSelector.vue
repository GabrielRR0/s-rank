<script setup lang="ts">
import { computed } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { EXPIRATION_OPTIONS_MINUTES } from '../../composables/fileSharing/useUpload'

const modelValue = defineModel<number>({ required: true })

const { t } = useLocale()

const ETIQUETAS: Record<number, string> = {
  10: 'expiration10m',
  60: 'expiration1h',
  360: 'expiration6h',
  1440: 'expiration1d',
}

const opciones = computed(() =>
  EXPIRATION_OPTIONS_MINUTES.map((minutos) => ({ minutos, label: t.value[ETIQUETAS[minutos]] })),
)
</script>

<template>
  <div class="expiration-selector">
    <span class="etiqueta">{{ t.expirationLabel }}</span>
    <div class="opciones" role="radiogroup">
      <button
        v-for="opcion in opciones"
        :key="opcion.minutos"
        type="button"
        class="opcion-expiracion"
        role="radio"
        :aria-checked="modelValue === opcion.minutos"
        :class="{ activo: modelValue === opcion.minutos }"
        @click="modelValue = opcion.minutos"
      >
        {{ opcion.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.expiration-selector {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.etiqueta {
  font-size: 0.9rem;
  color: var(--text);
}

.opciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.opcion-expiracion {
  padding: 0.5rem 0.875rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.opcion-expiracion.activo {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-contrast);
}

.opcion-expiracion:not(.activo):hover {
  border-color: var(--accent);
}
</style>
