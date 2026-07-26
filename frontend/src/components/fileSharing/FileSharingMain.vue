<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'
import { useUpload } from '../../composables/fileSharing/useUpload'
import { TURNSTILE_ENABLED } from '../../composables/fileSharing/useTurnstile'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import ExpirationSelector from './ExpirationSelector.vue'
import PasswordToggle from './PasswordToggle.vue'
import ShareResult from './ShareResult.vue'
import TurnstileWidget from './TurnstileWidget.vue'
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
</script>

<template>
  <BaseCard class="file-sharing-main">
    <ShareResult v-if="resultado" :resultado="resultado" @reiniciar="reiniciar" />

    <form v-else class="formulario" @submit.prevent="crear">
      <div class="tabs" role="tablist">
        <button
          type="button"
          class="tab"
          role="tab"
          :aria-selected="modo === 'text'"
          :class="{ activo: modo === 'text' }"
          @click="modo = 'text'"
        >
          {{ t.tabText }}
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          :aria-selected="modo === 'file'"
          :class="{ activo: modo === 'file' }"
          @click="modo = 'file'"
        >
          {{ t.tabFile }}
        </button>
      </div>

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
           script de Cloudflare (ver composables/fileSharing/useTurnstile.ts). -->
      <TurnstileWidget v-if="TURNSTILE_ENABLED" @token="turnstileToken = $event" />

      <BaseAlert :mensajes="errores.length ? errores : errorCreacion ? [errorCreacion] : []" />

      <BaseButton :disabled="creando" @click="crear">
        {{ creando ? t.creatingButton : t.createButton }}
      </BaseButton>
    </form>
  </BaseCard>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tabs {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  background: var(--bg);
  border: 1px solid var(--border);
}

.tab {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.tab.activo {
  background: var(--bg-surface);
  color: var(--text-h);
  box-shadow: var(--shadow-sm);
}

.campo-texto {
  padding: 0.875rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-h);
  font: inherit;
  font-size: 0.9375rem;
  line-height: 1.6;
  resize: vertical;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-texto:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
