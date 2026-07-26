<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { useOneTimeView } from '../../composables/fileSharing/useOneTimeView'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'

const props = defineProps<{ shareId: string }>()

const { t } = useLocale()
const { estado, requierePassword, password, errorPassword, contenido, revelar } = useOneTimeView(props.shareId)

const esImagen = computed(
  () => contenido.value?.contentType === 'file' && contenido.value.blob.type.startsWith('image/'),
)

let urlObjetoActual: string | null = null
const urlObjeto = computed(() => {
  if (contenido.value?.contentType !== 'file') return null
  urlObjetoActual = URL.createObjectURL(contenido.value.blob)
  return urlObjetoActual
})

// El objeto revelado solo se ve una vez y esta pantalla no vuelve a
// necesitarlo despues de irse - liberar la URL evita que el navegador
// retenga en memoria el contenido "ya visto" mas de lo necesario.
onUnmounted(() => {
  if (urlObjetoActual) URL.revokeObjectURL(urlObjetoActual)
})

watch(estado, (nuevo) => {
  if (nuevo === 'pide-password') {
    // Foco automatico en el campo de contraseña al mostrarlo, incluidos los
    // reintentos tras una contraseña incorrecta.
    requestAnimationFrame(() => document.getElementById('campo-password-visor')?.focus())
  }
})
</script>

<template>
  <BaseCard class="view-content">
    <p v-if="estado === 'cargando'" class="estado-texto">{{ t.viewLoading }}</p>

    <template v-else-if="estado === 'no-disponible'">
      <h2>{{ t.viewNotFoundHeading }}</h2>
      <p class="subtitulo">{{ t.viewNotFoundSubtitle }}</p>
    </template>

    <template v-else-if="estado === 'pide-password' || estado === 'listo-para-ver' || estado === 'revelando'">
      <h2>{{ requierePassword ? t.viewPasswordHeading : t.viewRevealHeading }}</h2>
      <p class="subtitulo">{{ requierePassword ? t.viewPasswordSubtitle : t.viewRevealSubtitle }}</p>

      <form class="formulario-revelar" @submit.prevent="revelar">
        <input
          v-if="requierePassword"
          id="campo-password-visor"
          v-model="password"
          type="password"
          class="campo-password"
          :placeholder="t.passwordPlaceholder"
        />
        <BaseAlert :mensajes="errorPassword ? [errorPassword] : []" />

        <BaseButton :disabled="estado === 'revelando'" @click="revelar">
          {{ estado === 'revelando' ? t.viewRevealingButton : t.viewRevealButton }}
        </BaseButton>
      </form>
    </template>

    <template v-else-if="estado === 'revelado' && contenido">
      <pre v-if="contenido.contentType === 'text'" class="texto-revelado">{{ contenido.text }}</pre>
      <div v-else class="archivo-revelado">
        <img v-if="esImagen" :src="urlObjeto!" class="imagen-revelada" :alt="contenido.fileName" />
        <a v-else :href="urlObjeto!" :download="contenido.fileName" class="descarga-enlace">
          <BaseButton>{{ t.viewDownloadButton }}</BaseButton>
        </a>
      </div>
    </template>

    <!-- Se ve tanto si el contenido ya se revelo como si el link ya no
         esta disponible (vencido/ya visto): en los dos casos el viaje del
         destinatario termino aca, es el momento natural para invitarlo a
         crear su propio enlace. Sin router: es una navegacion de pagina
         completa a "/", que App.vue ya sabe resolver como el flujo de
         creacion. -->
    <div v-if="estado === 'revelado' || estado === 'no-disponible'" class="crear-propio">
      <p class="crear-propio-texto">{{ t.viewCreateOwnPrompt }}</p>
      <a href="/" class="crear-propio-enlace">{{ t.viewCreateOwnButton }}</a>
    </div>
  </BaseCard>
</template>

<style scoped>
.view-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  animation: fade-in-up var(--duration-base) var(--ease-out) both;
}

.estado-texto {
  color: var(--text-muted);
  text-align: center;
  padding: 1rem 0;
}

.subtitulo {
  color: var(--text-muted);
  font-size: 0.9375rem;
}

.formulario-revelar {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.campo-password {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-h);
  font: inherit;
  font-size: 0.9375rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-password:focus {
  outline: none;
  border-color: var(--accent);
}

.texto-revelado {
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
  font-family: var(--sans);
  font-size: 0.9375rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.archivo-revelado {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
}

.imagen-revelada {
  max-width: 100%;
  border-radius: var(--radius-sm);
}

.crear-propio {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  text-align: center;
}

.crear-propio-texto {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.crear-propio-enlace {
  color: var(--accent);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.crear-propio-enlace:hover {
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
