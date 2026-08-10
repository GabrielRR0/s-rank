<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import type { CreateChatResult } from '../../composables/secretChat/useCreateChat'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{ resultado: CreateChatResult }>()
defineEmits<{ reiniciar: [] }>()

const { t } = useLocale()
const copiado = ref(false)

async function copiarEnlace() {
  await navigator.clipboard.writeText(props.resultado.enlace)
  copiado.value = true
  setTimeout(() => {
    copiado.value = false
  }, 2000)
}
</script>

<template>
  <div class="chat-create-result">
    <h2>{{ t.chatResultHeading }}</h2>
    <p class="subtitulo">{{ t.chatResultSubtitle }}</p>

    <div class="enlace-box">
      <span class="enlace-texto">{{ resultado.enlace }}</span>
      <BaseButton variant="secondary" @click="copiarEnlace">
        {{ copiado ? t.copiedButton : t.copyButton }}
      </BaseButton>
    </div>

    <!-- Navegacion de pagina completa a proposito (no vue-router): mismo
         criterio que ViewContent.vue al volver a "/" - App.vue ya sabe
         resolver /chat/:id via su router manual por regex. -->
    <a :href="resultado.enlace" class="entrar-ahora">
      <BaseButton>{{ t.chatEnterNowButton }}</BaseButton>
    </a>

    <button type="button" class="crear-otro" @click="$emit('reiniciar')">
      {{ t.chatCreateAnotherButton }}
    </button>
  </div>
</template>

<style scoped>
.chat-create-result {
  display: flex;
  flex-direction: column;
  /* min-width:0 en toda la cadena (aca y en .enlace-box mas abajo) - un
     link real puede ser mucho mas ancho que la pantalla, y sin esto un
     hijo flex nunca se encoge por debajo del contenido que tiene adentro,
     aunque el texto en si use ellipsis. */
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

.entrar-ahora {
  margin-top: 1.25rem;
  align-self: flex-start;
  text-decoration: none;
}

.crear-otro {
  align-self: flex-start;
  margin-top: 1rem;
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
