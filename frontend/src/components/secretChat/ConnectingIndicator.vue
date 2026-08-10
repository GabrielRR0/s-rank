<script setup lang="ts">
defineProps<{ texto: string }>()
</script>

<template>
  <div class="connecting-indicator">
    <div class="pulso-contenedor">
      <span class="anillo" aria-hidden="true"></span>
      <span class="anillo anillo-retrasado" aria-hidden="true"></span>
      <div class="icono-candado" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M10 1a4 4 0 00-4 4v2H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 6V5a2 2 0 10-4 0v2h4zm-2 4a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>
    <p class="texto">{{ texto }}</p>
  </div>
</template>

<style scoped>
/* Efecto "radar" (anillos que se expanden y desvanecen desde el candado) -
   solo opacity/transform, como pide DESIGN.md. Dos anillos desfasados 1s
   entre si para que siempre haya uno visible en distinta fase, en vez de
   un unico pulso que deja un hueco de silencio entre ciclos. */
.connecting-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  animation: fade-in var(--duration-base) var(--ease-out) both;
}

.pulso-contenedor {
  position: relative;
  width: 4.5rem;
  height: 4.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.anillo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--accent);
  opacity: 0;
  animation: pulso 2s var(--ease-out) infinite;
}

.anillo-retrasado {
  animation-delay: 1s;
}

.icono-candado {
  width: 2.75rem;
  height: 2.75rem;
  min-width: 2.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--accent-contrast);
}

.icono-candado svg {
  width: 1.375rem;
  height: 1.375rem;
}

.texto {
  color: var(--text-muted);
  font-size: 0.9375rem;
}

@keyframes pulso {
  0% {
    transform: scale(0.55);
    opacity: 0.7;
  }
  70% {
    opacity: 0;
  }
  100% {
    transform: scale(1.7);
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
