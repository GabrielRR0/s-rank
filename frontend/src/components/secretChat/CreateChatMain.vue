<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { TURNSTILE_ENABLED } from '../../composables/useTurnstile'
import { CAPACIDAD_OPCIONES, TTL_OPCIONES_SEGUNDOS, useCreateChat } from '../../composables/secretChat/useCreateChat'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import PasswordToggle from '../ui/PasswordToggle.vue'
import TurnstileWidget from '../ui/TurnstileWidget.vue'
import ChatCreateResult from './ChatCreateResult.vue'

const { t } = useLocale()
const {
  apodo,
  capacidadMaxima,
  ttlSegundos,
  protegerConPassword,
  password,
  turnstileToken,
  errores,
  errorCreacion,
  creando,
  resultado,
  crear,
  reiniciar,
} = useCreateChat()

const turnstileWidget = ref<InstanceType<typeof TurnstileWidget> | null>(null)

// Mismo motivo que FileSharingMain.vue: errorCreacion (no `errores`, que es
// solo validacion local) marca que hubo un intento de red real que fallo -
// el token de Turnstile ya usado en ese intento no sirve para reintentar.
async function manejarSubmit() {
  await crear()
  if (errorCreacion.value) turnstileWidget.value?.reset()
}
</script>

<template>
  <BaseCard class="create-chat-main">
    <ChatCreateResult v-if="resultado" :resultado="resultado" @reiniciar="reiniciar" />

    <form v-else class="formulario" @submit.prevent="manejarSubmit">
      <p class="subtitulo">{{ t.chatCreateSubtitle }}</p>

      <label class="campo">
        <span class="etiqueta">{{ t.nicknameLabel }}</span>
        <input v-model="apodo" type="text" class="campo-input" :placeholder="t.nicknamePlaceholder" maxlength="24" />
      </label>

      <div class="campo">
        <span class="etiqueta">{{ t.chatCapacityLabel }}</span>
        <div class="opciones">
          <button
            v-for="opcion in CAPACIDAD_OPCIONES"
            :key="opcion"
            type="button"
            class="opcion"
            :class="{ activo: capacidadMaxima === opcion }"
            @click="capacidadMaxima = opcion"
          >
            {{ opcion }}
          </button>
        </div>
      </div>

      <div class="campo">
        <span class="etiqueta">{{ t.chatTtlLabel }}</span>
        <div class="opciones">
          <button
            v-for="opcion in TTL_OPCIONES_SEGUNDOS"
            :key="opcion"
            type="button"
            class="opcion"
            :class="{ activo: ttlSegundos === opcion }"
            @click="ttlSegundos = opcion"
          >
            {{ opcion }}s
          </button>
        </div>
      </div>

      <PasswordToggle v-model:activo="protegerConPassword" v-model:password="password" />

      <TurnstileWidget v-if="TURNSTILE_ENABLED" ref="turnstileWidget" @token="turnstileToken = $event" />

      <BaseAlert :mensajes="errores.length ? errores : errorCreacion ? [errorCreacion] : []" />

      <BaseButton :disabled="creando" @click="manejarSubmit">
        {{ creando ? t.chatCreatingButton : t.chatCreateButton }}
      </BaseButton>
    </form>
  </BaseCard>
</template>

<style scoped>
/* .contenido-centrado (App.vue) es flex, y BaseCard no trae ancho propio -
   sin esto, la tarjeta se agranda para ajustarse a su contenido en vez de
   respetar el ancho disponible. Pasa desapercibido con el formulario (nada
   ahi es mas ancho que la tarjeta), pero se nota fuerte en ChatCreateResult
   de abajo: un link sin cortar es mucho mas ancho que cualquier pantalla,
   y sin este limite estiraba toda la tarjeta (y los botones con ella) fuera
   del viewport en mobile. Mismo valor que .file-sharing-main. */
.create-chat-main {
  width: 100%;
  max-width: 30rem;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.subtitulo {
  color: var(--text-muted);
  font-size: 0.9375rem;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.etiqueta {
  font-size: 0.9rem;
  color: var(--text);
}

.campo-input {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-h);
  font: inherit;
  /* 1rem, no 0.9375rem: evita el zoom automatico de iOS Safari al enfocar
     (se dispara por debajo de 16px). */
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-input:focus {
  outline: none;
  border-color: var(--accent);
}

.opciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.opcion {
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

.opcion.activo {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-contrast);
}

.opcion:not(.activo):hover {
  border-color: var(--accent);
}
</style>
