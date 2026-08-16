<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import { useMediaAttachment } from '../../composables/secretChat/useMediaAttachment'
import { useVoiceRecorder } from '../../composables/secretChat/useVoiceRecorder'
import { validateMessageInput } from '../../utils/validators/validateChatInput'
import MediaSendPrompt from './MediaSendPrompt.vue'

const props = defineProps<{ clave: CryptoKey; roomId: string; respondiendoA: MensajeChat | null }>()
const emit = defineEmits<{
  enviar: [texto: string]
  escribiendo: []
  'enviar-media': [datos: ArrayBuffer, mimeType: string]
  compartido: [vaultId: string, maxCopias: number, expiraEn: string]
  'cancelar-respuesta': []
}>()

const { t } = useLocale()
const texto = ref('')
const error = ref('')

const { archivoSeleccionado, error: errorAdjunto, seleccionarArchivo, limpiar: limpiarAdjunto } = useMediaAttachment()
const { grabando, duracionSegundos, error: errorGrabacion, iniciar: iniciarGrabacion, detener: detenerGrabacion } =
  useVoiceRecorder()
const audioGrabado = ref<{ datos: ArrayBuffer; mimeType: string } | null>(null)
// Combina ambas fuentes en una unica prop tipada sin nulls para
// MediaSendPrompt.vue - solo se renderiza cuando alguna de las dos existe
// (ver v-if de abajo), asi que este computed nunca se lee en null en la
// practica, pero mantiene el template libre de asserts de TypeScript.
const archivoParaEnviar = computed(() => archivoSeleccionado.value ?? audioGrabado.value)

function manejarInput() {
  // El throttle real (no mandar un broadcast por cada tecla) vive en
  // useTypingIndicator.notificarEscribiendo - este componente solo avisa
  // "algo cambio", sin saber ni importarle cuando fue el ultimo aviso.
  if (texto.value.trim()) emit('escribiendo')
}

function enviar() {
  if (!texto.value.trim()) return
  const errores = validateMessageInput(texto.value, t.value.errorMessageTooLong)
  if (errores.length) {
    error.value = errores[0]
    return
  }
  error.value = ''
  emit('enviar', texto.value)
  texto.value = ''
}

async function alternarGrabacion() {
  if (grabando.value) {
    audioGrabado.value = await detenerGrabacion()
  } else {
    await iniciarGrabacion()
  }
}

function cerrarPrompt() {
  limpiarAdjunto()
  audioGrabado.value = null
}

function manejarEnviarMedia(datos: ArrayBuffer, mimeType: string) {
  emit('enviar-media', datos, mimeType)
  cerrarPrompt()
}

function manejarCompartido(vaultId: string, maxCopias: number, expiraEn: string) {
  emit('compartido', vaultId, maxCopias, expiraEn)
  cerrarPrompt()
}
</script>

<template>
  <div class="message-composer">
    <MediaSendPrompt
      v-if="archivoParaEnviar"
      :clave="clave"
      :room-id="roomId"
      :archivo="archivoParaEnviar"
      @enviar-media="manejarEnviarMedia"
      @compartido="manejarCompartido"
      @cancelar="cerrarPrompt"
    />

    <template v-else>
      <div v-if="respondiendoA" class="respondiendo-barra">
        <div class="respondiendo-texto">
          <span class="respondiendo-etiqueta">{{ t.replyingToLabel.replace('{apodo}', respondiendoA.autor) }}</span>
          <span v-if="respondiendoA.texto" class="respondiendo-extracto">{{ respondiendoA.texto }}</span>
        </div>
        <button
          type="button"
          class="boton-cancelar-respuesta"
          :aria-label="t.replyingToCancelAria"
          @click="emit('cancelar-respuesta')"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M5.28 4.22a.75.75 0 00-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 101.06 1.06L10 11.06l4.72 4.72a.75.75 0 101.06-1.06L11.06 10l4.72-4.72a.75.75 0 00-1.06-1.06L10 8.94 5.28 4.22z"
            />
          </svg>
        </button>
      </div>

      <form class="fila" @submit.prevent="enviar">
      <input type="file" accept="image/*" class="input-oculto" id="input-adjuntar-imagen" @change="seleccionarArchivo" />
      <label for="input-adjuntar-imagen" class="boton-icono" :aria-label="t.attachImageAria" :title="t.attachImageAria">
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M8 4a3 3 0 00-3 3v6a5 5 0 0010 0V7a1 1 0 112 0v6a7 7 0 11-14 0V7a5 5 0 0110 0v6a3 3 0 11-6 0V7a1 1 0 112 0v6a1 1 0 102 0V7a3 3 0 00-3-3z"
            clip-rule="evenodd"
          />
        </svg>
      </label>

      <input
        v-model="texto"
        type="text"
        class="campo-mensaje"
        :placeholder="t.chatMessagePlaceholder"
        maxlength="2000"
        @input="manejarInput"
      />

      <button
        type="button"
        class="boton-icono"
        :class="{ grabando }"
        :aria-label="grabando ? t.stopRecordingAria : t.recordAudioAria"
        :title="grabando ? t.stopRecordingAria : t.recordAudioAria"
        @click="alternarGrabacion"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 2a3 3 0 00-3 3v5a3 3 0 006 0V5a3 3 0 00-3-3z" />
          <path d="M5 9a1 1 0 10-2 0 7 7 0 006 6.93V18H7a1 1 0 100 2h6a1 1 0 100-2h-2v-2.07A7 7 0 0017 9a1 1 0 10-2 0 5 5 0 01-10 0z" />
        </svg>
      </button>

      <button type="submit" class="boton-enviar" :aria-label="t.chatSendButton" :disabled="!texto.trim()">
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3 10l13-6-4 6 4 6-13-6z" />
        </svg>
      </button>
      </form>
    </template>

    <p v-if="grabando" class="grabando-texto">{{ t.recordingLabel.replace('{segundos}', String(duracionSegundos)) }}</p>
    <p v-if="error" class="error-mensaje">{{ error }}</p>
    <p v-if="errorAdjunto" class="error-mensaje">{{ errorAdjunto }}</p>
    <p v-if="errorGrabacion" class="error-mensaje">{{ errorGrabacion }}</p>
  </div>
</template>

<style scoped>
.message-composer {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.fila {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.respondiendo-barra {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.375rem 0.75rem;
  border-left: 2px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--bg-inset);
}

.respondiendo-texto {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
}

.respondiendo-etiqueta {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
}

.respondiendo-extracto {
  font-size: 0.8125rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boton-cancelar-respuesta {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.boton-cancelar-respuesta svg {
  width: 0.875rem;
  height: 0.875rem;
}

.campo-mensaje {
  flex: 1;
  min-width: 0;
  padding: 0.625rem 1.125rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  /* 1rem (16px), no 0.9375rem: por debajo de 16px, iOS Safari hace zoom
     automatico al enfocar el input - se sentia como que "el chat se mueve"
     cada vez que se tocaba el campo de escribir. */
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-mensaje:focus {
  outline: none;
  border-color: var(--accent);
}

.input-oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}

.boton-icono {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.boton-icono svg {
  width: 1.125rem;
  height: 1.125rem;
}

.boton-icono:hover {
  color: var(--accent);
  background: var(--bg);
  border-color: var(--accent);
}

.boton-icono.grabando {
  color: var(--alert-text);
  background: color-mix(in srgb, var(--alert-text) 14%, transparent);
  border-color: var(--alert-text);
}

.grabando-texto {
  padding: 0 0.25rem;
  color: var(--alert-text);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.boton-enviar {
  width: 2.5rem;
  height: 2.5rem;
  min-width: 2.5rem;
  border-radius: 50%;
  border: none;
  background: var(--accent-gradient);
  box-shadow: var(--shadow-glow-sm);
  color: var(--accent-contrast);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.boton-enviar svg {
  width: 1.125rem;
  height: 1.125rem;
}

.boton-enviar:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.boton-enviar:not(:disabled):hover {
  opacity: 0.88;
}

.boton-enviar:not(:disabled):active {
  transform: scale(0.94);
}

.error-mensaje {
  padding: 0 0.25rem;
  color: var(--alert-text);
  font-size: 0.8125rem;
}
</style>
