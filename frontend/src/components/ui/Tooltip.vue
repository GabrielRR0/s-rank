<script setup lang="ts">
withDefaults(
  defineProps<{ texto: string; posicion?: 'arriba' | 'abajo'; alinear?: 'centro' | 'derecha' }>(),
  {
    posicion: 'arriba',
    alinear: 'centro',
  },
)
</script>

<template>
  <span class="tooltip-wrapper">
    <slot />
    <span class="tooltip-burbuja" :class="[posicion, alinear]" role="tooltip">{{ texto }}</span>
  </span>
</template>

<style scoped>
/* CSS puro (:hover/:focus-within), sin JS de posicionamiento - alcanza
   para el caso de uso real de este proyecto (un texto corto explicativo
   sobre un boton/icono chico). Solo opacity/transform, como pide DESIGN.md.
   `alinear="derecha"` existe para triggers pegados al borde derecho de su
   contenedor (ej. MediaSendPrompt.vue) - centrado ahi haria que la burbuja
   se corte contra el borde de la pantalla. */
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.tooltip-burbuja {
  position: absolute;
  min-width: max-content;
  max-width: min(15rem, 80vw);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--text-h);
  color: var(--bg-surface);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
  text-align: center;
  white-space: normal;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  z-index: 30;
}

.tooltip-burbuja.centro {
  left: 50%;
}

.tooltip-burbuja.derecha {
  right: 0;
}

.tooltip-burbuja.arriba {
  bottom: calc(100% + 0.5rem);
}

.tooltip-burbuja.abajo {
  top: calc(100% + 0.5rem);
}

.tooltip-burbuja.centro.arriba {
  transform: translate(-50%, 4px);
}

.tooltip-burbuja.centro.abajo {
  transform: translate(-50%, -4px);
}

.tooltip-burbuja.derecha.arriba {
  transform: translateY(4px);
}

.tooltip-burbuja.derecha.abajo {
  transform: translateY(-4px);
}

.tooltip-wrapper:hover .tooltip-burbuja.centro,
.tooltip-wrapper:focus-within .tooltip-burbuja.centro {
  opacity: 1;
  transform: translate(-50%, 0);
}

.tooltip-wrapper:hover .tooltip-burbuja.derecha,
.tooltip-wrapper:focus-within .tooltip-burbuja.derecha {
  opacity: 1;
  transform: translateY(0);
}
</style>
