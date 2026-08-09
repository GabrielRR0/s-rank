<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ opciones: { valor: string; etiqueta: string }[] }>()
const modelValue = defineModel<string>({ required: true })

const indiceActivo = computed(() => Math.max(0, props.opciones.findIndex((opcion) => opcion.valor === modelValue.value)))
</script>

<template>
  <div class="segmented-toggle" role="tablist" :style="{ '--cantidad-opciones': opciones.length }">
    <!-- Indicador deslizante: una sola pieza que se mueve con transform en
         vez de que cada boton prenda/apague su propio fondo - lo que hace
         que el cambio se sienta como un movimiento continuo (mismo boton
         que "viaja") en vez de un cambio de estado instantaneo. Solo
         transform, como pide DESIGN.md. -->
    <span class="indicador" aria-hidden="true" :style="{ transform: `translateX(${indiceActivo * 100}%)` }"></span>
    <button
      v-for="opcion in opciones"
      :key="opcion.valor"
      type="button"
      class="tab"
      role="tab"
      :aria-selected="modelValue === opcion.valor"
      :class="{ activo: modelValue === opcion.valor }"
      @click="modelValue = opcion.valor"
    >
      {{ opcion.etiqueta }}
    </button>
  </div>
</template>

<style scoped>
.segmented-toggle {
  position: relative;
  display: inline-flex;
  align-self: flex-start;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  background: var(--bg-inset);
  border: 1px solid var(--border);
}

.indicador {
  position: absolute;
  top: 0.25rem;
  bottom: 0.25rem;
  left: 0.25rem;
  width: calc((100% - 0.5rem) / var(--cantidad-opciones));
  border-radius: calc(var(--radius-sm) - 2px);
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-base) var(--ease-out);
}

.tab {
  position: relative;
  z-index: 1;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}

.tab.activo {
  color: var(--text-h);
}
</style>
