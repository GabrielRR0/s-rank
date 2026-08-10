<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { cifrarBinario } from '../../services/secretChat/crypto.service'
import { createVaultMediaItem } from '../../services/secretChat/vault.service'
import BaseAlert from '../ui/BaseAlert.vue'
import Tooltip from '../ui/Tooltip.vue'

const props = defineProps<{
  clave: CryptoKey
  roomId: string
  archivo: { datos: ArrayBuffer; mimeType: string }
}>()
const emit = defineEmits<{
  'enviar-media': [datos: ArrayBuffer, mimeType: string]
  compartido: [vaultId: string, maxCopias: number, expiraEn: string]
  cancelar: []
}>()

const { t } = useLocale()

const esImagen = computed(() => props.archivo.mimeType.startsWith('image/'))
// Fijo, no elegible - mismo motivo que TTL_SEGUNDOS en VaultComposer.vue:
// tiene que ser uno de los valores que el backend permite (ALLOWED_VAULT_TTL_SECONDS).
const TTL_SEGUNDOS = 60
const COPIAS_OPCIONES = [1, 2, 3, 4, 5, 6] as const
const maxCopias = ref(2)
const mostrandoOpcionesCofre = ref(false)
const enviando = ref(false)
const error = ref('')

// Se crea una unica vez (no un computed) porque `archivo` no cambia durante
// la vida de esta instancia - el padre monta una instancia nueva por cada
// seleccion/grabacion nueva. Revocado al cerrar este prompt (enviado o
// cancelado), sea cual sea el camino elegido.
const previewUrl = ref(URL.createObjectURL(new Blob([props.archivo.datos], { type: props.archivo.mimeType })))
onUnmounted(() => URL.revokeObjectURL(previewUrl.value))

function enviarEnElChat() {
  emit('enviar-media', props.archivo.datos, props.archivo.mimeType)
}

async function guardarEnElCofre() {
  enviando.value = true
  error.value = ''
  try {
    const cifrado = await cifrarBinario(props.clave, props.archivo.datos)
    const { id, expiresAt } = await createVaultMediaItem({
      contentType: esImagen.value ? 'image' : 'audio',
      mimeType: props.archivo.mimeType,
      maxCopies: maxCopias.value,
      ttlSeconds: TTL_SEGUNDOS,
      roomId: props.roomId,
      ciphertext: cifrado.ciphertext,
      nonce: cifrado.nonce,
    })
    emit('compartido', id, maxCopias.value, expiresAt)
  } catch {
    error.value = t.value.errorMediaSendFailed
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="media-send-prompt">
    <img v-if="esImagen" class="preview-imagen" :src="previewUrl" :alt="t.mediaPreviewImageAlt" />
    <audio v-else class="preview-audio" :src="previewUrl" controls />

    <p class="pregunta">{{ t.mediaSendPromptQuestion }}</p>

    <template v-if="!mostrandoOpcionesCofre">
      <div class="acciones">
        <button type="button" class="boton boton-primario" :disabled="enviando" @click="enviarEnElChat">
          {{ t.mediaSendPromptSendButton }}
        </button>
        <!-- style inline (no class) a proposito: gana por especificidad sobre
             el .tooltip-wrapper{display:inline-flex} propio de Tooltip.vue sin
             depender del orden de bundling entre los estilos scoped de dos
             componentes distintos - ver el mismo problema ya evitado con
             AppLogo.vue en App.vue. -->
        <Tooltip :texto="t.mediaVaultTooltip" alinear="derecha" style="flex: 1; display: flex">
          <button
            type="button"
            class="boton boton-secundario"
            style="width: 100%"
            :disabled="enviando"
            @click="mostrandoOpcionesCofre = true"
          >
            {{ t.mediaSendPromptVaultButton }}
          </button>
        </Tooltip>
      </div>
      <button type="button" class="boton-cancelar" @click="emit('cancelar')">{{ t.mediaSendPromptCancel }}</button>
    </template>

    <template v-else>
      <div class="fila-copias">
        <span class="etiqueta">{{ t.vaultMaxCopiesLabel }}</span>
        <div class="opciones">
          <button
            v-for="opcion in COPIAS_OPCIONES"
            :key="opcion"
            type="button"
            class="opcion"
            :class="{ activo: maxCopias === opcion }"
            @click="maxCopias = opcion"
          >
            {{ opcion }}
          </button>
        </div>
      </div>
      <BaseAlert :mensajes="error ? [error] : []" />
      <div class="acciones">
        <button type="button" class="boton boton-primario" :disabled="enviando" @click="guardarEnElCofre">
          {{ enviando ? t.mediaSendPromptSending : t.mediaSendPromptVaultButton }}
        </button>
        <button type="button" class="boton-cancelar" :disabled="enviando" @click="mostrandoOpcionesCofre = false">
          {{ t.mediaSendPromptCancel }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.media-send-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
}

.preview-imagen {
  max-width: 100%;
  max-height: 12rem;
  border-radius: var(--radius-sm);
  object-fit: contain;
  align-self: center;
}

.preview-audio {
  width: 100%;
}

.pregunta {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.acciones {
  display: flex;
  gap: 0.625rem;
}

.boton {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.boton-primario {
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
}

.boton-secundario {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-h);
}

.boton:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.boton:not(:disabled):hover {
  opacity: 0.88;
}

.boton-cancelar {
  align-self: center;
  border: none;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}

.boton-cancelar:hover {
  color: var(--text);
}

.fila-copias {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.etiqueta {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.opciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.opcion {
  width: 2rem;
  height: 2rem;
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
</style>
