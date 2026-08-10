<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { useUpload } from '../../composables/fileSharing/useUpload'
import { TURNSTILE_ENABLED } from '../../composables/useTurnstile'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import PasswordToggle from '../ui/PasswordToggle.vue'
import SegmentedToggle from '../ui/SegmentedToggle.vue'
import TurnstileWidget from '../ui/TurnstileWidget.vue'
import ExpirationSelector from './ExpirationSelector.vue'
import ShareResult from './ShareResult.vue'
import UploadZone from './UploadZone.vue'

const { t } = useLocale()
const {
  modo,
  texto,
  archivo,
  password,
  protegerConPassword,
  expiracionMinutos,
  errores,
  creando,
  resultado,
  errorCreacion,
  turnstileToken,
  elegirArchivo,
  crear,
  reiniciar,
} = useUpload()

const turnstileWidget = ref<InstanceType<typeof TurnstileWidget> | null>(null)

// El token de Turnstile es de un solo uso - si crear() fallo del lado del
// servidor (ej. rate limit, contraseña invalida en otro campo), el token ya
// se gasto en ese intento. Sin pedir uno nuevo, un reintento manda el mismo
// token vencido y Cloudflare lo rechaza de nuevo sin importar que el resto
// del formulario ahora este bien. errorCreacion (no `errores`, que son solo
// de validacion local sin red) es la señal precisa de "hubo un intento real".
async function manejarSubmit() {
  await crear()
  if (errorCreacion.value) turnstileWidget.value?.reset()
}
</script>

<template>
  <BaseCard class="file-sharing-main">
    <ShareResult v-if="resultado" :resultado="resultado" @reiniciar="reiniciar" />

    <form v-else class="formulario" @submit.prevent="manejarSubmit">
      <SegmentedToggle
        v-model="modo"
        :opciones="[
          { valor: 'text', etiqueta: t.tabText },
          { valor: 'file', etiqueta: t.tabFile },
        ]"
      />

      <textarea
        v-if="modo === 'text'"
        v-model="texto"
        class="campo-texto"
        rows="6"
        :placeholder="t.textPlaceholder"
      />
      <UploadZone v-else :archivo="archivo" @update:archivo="elegirArchivo" />

      <PasswordToggle v-model:activo="protegerConPassword" v-model:password="password" />
      <ExpirationSelector v-model="expiracionMinutos" />

      <!-- Apagado por defecto (TURNSTILE_ENABLED via VITE_TURNSTILE_ENABLED)
           - sin la variable de entorno, este widget ni se monta ni carga el
           script de Cloudflare (ver composables/useTurnstile.ts). -->
      <TurnstileWidget v-if="TURNSTILE_ENABLED" ref="turnstileWidget" @token="turnstileToken = $event" />

      <BaseAlert :mensajes="errores.length ? errores : errorCreacion ? [errorCreacion] : []" />

      <BaseButton :disabled="creando" @click="manejarSubmit">
        {{ creando ? t.creatingButton : t.createButton }}
      </BaseButton>
    </form>
  </BaseCard>
</template>

<style scoped>
.file-sharing-main {
  width: 100%;
  max-width: 30rem;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.campo-texto {
  padding: 0.875rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  /* 1rem, no 0.9375rem: evita el zoom automatico de iOS Safari al enfocar
     (se dispara por debajo de 16px). */
  font-size: 1rem;
  line-height: 1.6;
  resize: vertical;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-texto:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
