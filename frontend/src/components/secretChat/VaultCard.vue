<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'
import { useVaultItem } from '../../composables/secretChat/useVaultItem'
import type { VaultPointer } from '../../composables/secretChat/useSecretChatRoom'
import AudioPlayer from '../ui/AudioPlayer.vue'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{ vault: VaultPointer; clave: CryptoKey }>()
const emit = defineEmits<{ copiado: [vaultId: string, copiasRestantes: number] }>()

const { t } = useLocale()
const {
  estado,
  contentType,
  valorDescifrado,
  valorDescifradoUrl,
  valorDescifradoDatos,
  revelado,
  copiando,
  errorCopia,
  alternarRevelado,
  copiar,
} = useVaultItem(props.vault.vaultId, props.clave)

async function manejarCopiar() {
  const restantes = await copiar()
  if (restantes !== null) emit('copiado', props.vault.vaultId, restantes)
}
</script>

<template>
  <div class="vault-card">
    <div class="encabezado">
      <span class="icono-candado" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M10 1a4 4 0 00-4 4v2H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 6V5a2 2 0 10-4 0v2h4zm-2 4a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z"
            clip-rule="evenodd"
          />
        </svg>
      </span>
      <span class="titulo">{{ t.vaultCardHeading }}</span>
      <span class="contador">{{ vault.copiasRestantes }}/{{ vault.maxCopias }}</span>
    </div>

    <template v-if="estado === 'disponible' && contentType === 'text'">
      <p class="valor" :class="{ enmascarado: !revelado }">{{ revelado ? valorDescifrado : '••••••••••' }}</p>
      <div class="acciones">
        <button type="button" class="link-boton" @click="alternarRevelado">
          {{ revelado ? t.vaultHideButton : t.vaultRevealButton }}
        </button>
        <BaseButton variant="secondary" :disabled="copiando" @click="manejarCopiar">
          {{ copiando ? t.vaultCopyingButton : t.vaultCopyButton }}
        </BaseButton>
      </div>
      <p v-if="errorCopia" class="error-copia">{{ errorCopia }}</p>
    </template>

    <template v-else-if="estado === 'disponible' && (contentType === 'image' || contentType === 'audio')">
      <!-- A diferencia del texto, no hay un toggle "Mostrar/Ocultar" libre -
           el unico boton ya es la accion que gasta la copia (ver
           useVaultItem.copiar()), asi que revelar y consumir pasan juntos.
           Rama explicita por tipo (nunca un v-else generico) a proposito:
           un content_type inesperado/faltante debe caer en el mensaje de
           "no disponible" de abajo, no adivinar un tipo al azar. -->
      <template v-if="revelado">
        <img
          v-if="contentType === 'image'"
          class="valor-imagen"
          :src="valorDescifradoUrl ?? ''"
          alt=""
          draggable="false"
          @contextmenu.prevent
        />
        <AudioPlayer v-else-if="valorDescifradoDatos" :datos="valorDescifradoDatos" />
      </template>
      <p v-else class="valor enmascarado">••••••••••</p>
      <div v-if="!revelado" class="acciones">
        <BaseButton variant="secondary" :disabled="copiando" @click="manejarCopiar">
          {{ copiando ? t.vaultCopyingButton : contentType === 'image' ? t.vaultViewButton : t.vaultPlayButton }}
        </BaseButton>
      </div>
      <p v-if="errorCopia" class="error-copia">{{ errorCopia }}</p>
    </template>

    <p v-else-if="estado === 'cargando'" class="estado-texto">{{ t.viewLoading }}</p>
    <p v-else class="estado-texto">{{ t.vaultExhaustedText }}</p>
  </div>
</template>

<style scoped>
.vault-card {
  /* Deliberadamente NO parece una burbuja de mensaje: sin el radio
     asimetrico de "cola" (ver MessageBubble.vue), con un borde izquierdo
     grueso a color en vez de un borde parejo - mismo lenguaje visual que
     un "callout"/aviso, no una burbuja de chat mas. */
  position: relative;
  padding: 0.75rem 0.875rem 0.75rem 1rem;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-surface));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.encabezado {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.icono-candado {
  display: flex;
  color: var(--accent);
}

.icono-candado svg {
  width: 0.875rem;
  height: 0.875rem;
}

.titulo {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.contador {
  margin-left: auto;
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.valor {
  font-family: ui-monospace, monospace;
  font-size: 0.9375rem;
  color: var(--text-h);
  word-break: break-word;
}

.valor.enmascarado {
  letter-spacing: 0.125rem;
}

.valor-imagen {
  max-width: 100%;
  max-height: 14rem;
  border-radius: var(--radius-sm);
  object-fit: contain;
  -webkit-user-drag: none;
  -webkit-touch-callout: none;
  user-select: none;
}

.acciones {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.link-boton {
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0;
}

.estado-texto {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.error-copia {
  color: var(--alert-text);
  font-size: 0.8125rem;
}
</style>
