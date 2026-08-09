<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { cifrarTexto } from '../../services/secretChat/crypto.service'
import { createVaultItem } from '../../services/secretChat/vault.service'
import { validateVaultSecretInput } from '../../utils/validators/validateChatInput'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseButton from '../ui/BaseButton.vue'
import Tooltip from '../ui/Tooltip.vue'

const props = defineProps<{ clave: CryptoKey; roomId: string }>()
const emit = defineEmits<{ compartido: [vaultId: string, maxCopias: number, expiraEn: string] }>()

const { t } = useLocale()
const abierto = ref(false)
const secreto = ref('')
const maxCopias = ref(2)
const compartiendo = ref(false)
const errores = ref<string[]>([])

const COPIAS_OPCIONES = [1, 2, 3, 4, 5, 6] as const
// Fijo (no elegible en la UI): coincide con uno de los valores permitidos
// server-side (ALLOWED_VAULT_TTL_SECONDS en backend/app/schemas/secretVault/).
// El TTL de mensajes normales si es elegible (useCreateChat.ts) porque ese
// nunca lo valida el backend - el del Cofre si, y solo puede ser uno de un
// set fijo.
const TTL_SEGUNDOS = 60

function cancelar() {
  abierto.value = false
  secreto.value = ''
  errores.value = []
}

async function compartir() {
  errores.value = validateVaultSecretInput(secreto.value, t.value.errorVaultSecretRequired, t.value.errorVaultSecretTooLong)
  if (errores.value.length) return

  compartiendo.value = true
  try {
    const cifrado = await cifrarTexto(props.clave, secreto.value)
    const { id, expiresAt } = await createVaultItem({
      ciphertext: cifrado.ciphertext,
      nonce: cifrado.nonce,
      maxCopies: maxCopias.value,
      ttlSeconds: TTL_SEGUNDOS,
      roomId: props.roomId,
    })
    emit('compartido', id, maxCopias.value, expiresAt)
    secreto.value = ''
    abierto.value = false
  } catch {
    errores.value = [t.value.errorVaultShareFailed]
  } finally {
    compartiendo.value = false
  }
}
</script>

<template>
  <div class="vault-composer">
    <Tooltip v-if="!abierto" :texto="t.vaultInfoTooltip">
      <button type="button" class="abrir-boton" @click="abierto = true">
        {{ t.vaultComposerHeading }}
      </button>
    </Tooltip>

    <form v-else class="formulario" @submit.prevent="compartir">
      <textarea v-model="secreto" class="campo-texto" rows="2" :placeholder="t.vaultSecretPlaceholder" />

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

      <BaseAlert :mensajes="errores" />

      <div class="acciones">
        <BaseButton :disabled="compartiendo" @click="compartir">
          {{ compartiendo ? t.vaultSharingButton : t.vaultShareButton }}
        </BaseButton>
        <button type="button" class="cancelar-boton" :disabled="compartiendo" @click="cancelar">
          {{ t.vaultComposerCancel }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.vault-composer {
  display: flex;
  flex-direction: column;
}

.abrir-boton {
  align-self: flex-start;
  border: 1px solid var(--border);
  background: none;
  border-radius: 999px;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  padding: 0.5rem 0.875rem;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.abrir-boton:hover {
  border-color: var(--accent);
  color: var(--text);
}

.acciones {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cancelar-boton {
  border: none;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0;
}

.cancelar-boton:hover {
  color: var(--text);
}

.cancelar-boton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.campo-texto {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 0.9375rem;
  resize: vertical;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-texto:focus {
  outline: none;
  border-color: var(--accent);
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
  border-color: transparent;
  background: var(--accent-gradient);
  box-shadow: var(--shadow-glow-sm);
  color: var(--accent-contrast);
}
</style>
