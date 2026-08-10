<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import type { CreateShareResult } from '../../services/fileSharing/sharing.service'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{ resultado: CreateShareResult }>()
defineEmits<{ reiniciar: [] }>()

const { t } = useLocale()
const copiado = ref(false)

// url_path es relativo a proposito (el backend no conoce su propio dominio
// publico, ver backend/app/schemas/sharedContent/README.md) - el origin lo
// pone el navegador que esta mostrando este resultado.
const urlCompleta = `${window.location.origin}${props.resultado.urlPath}`

async function copiarEnlace() {
  await navigator.clipboard.writeText(urlCompleta)
  copiado.value = true
  setTimeout(() => {
    copiado.value = false
  }, 2000)
}
</script>

<template>
  <div class="share-result">
    <h2>{{ t.resultHeading }}</h2>
    <p class="subtitulo">{{ t.resultSubtitle }}</p>

    <div class="enlace-box">
      <span class="enlace-texto">{{ urlCompleta }}</span>
      <BaseButton variant="secondary" @click="copiarEnlace">
        {{ copiado ? t.copiedButton : t.copyButton }}
      </BaseButton>
    </div>

    <button type="button" class="crear-otro" @click="$emit('reiniciar')">
      {{ t.createAnotherButton }}
    </button>
  </div>
</template>

<style scoped>
.share-result {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.5rem;
  animation: fade-in-up var(--duration-base) var(--ease-out) both;
}

.subtitulo {
  color: var(--text-muted);
  font-size: 0.9375rem;
}

.enlace-box {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
}

.enlace-texto {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  color: var(--text-h);
}

.crear-otro {
  align-self: flex-start;
  margin-top: 1.5rem;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.crear-otro:hover {
  opacity: 0.8;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
