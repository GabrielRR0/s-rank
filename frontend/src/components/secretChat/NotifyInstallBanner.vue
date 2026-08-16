<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { useChatNotifications } from '../../composables/secretChat/useChatNotifications'
import { useInstallPrompt } from '../../composables/useInstallPrompt'
import BaseButton from '../ui/BaseButton.vue'

const { t } = useLocale()
const { soportado: notifSoportado, permiso, pedirPermiso } = useChatNotifications()
const { disponible, instalada, esIOS, instalar } = useInstallPrompt()

const CLAVE_NOTIF_DESCARTADO = 's-rank:notify-banner-dismissed'
const CLAVE_INSTALL_DESCARTADO = 's-rank:install-banner-dismissed'
const notifDescartado = ref(localStorage.getItem(CLAVE_NOTIF_DESCARTADO) === '1')
const installDescartado = ref(localStorage.getItem(CLAVE_INSTALL_DESCARTADO) === '1')

// permiso === 'default': el navegador todavia no decidio nada - 'granted' y
// 'denied' ya son decisiones tomadas (y 'denied' ni siquiera se puede volver
// a pedir por JS), no hay nada mas que ofrecer en ninguno de esos dos casos.
const mostrarNotif = computed(() => notifSoportado.value && permiso.value === 'default' && !notifDescartado.value)
const mostrarInstall = computed(() => !installDescartado.value && !instalada.value && (disponible.value || esIOS))
const mostrarAlgo = computed(() => mostrarNotif.value || mostrarInstall.value)

function descartarNotif() {
  notifDescartado.value = true
  localStorage.setItem(CLAVE_NOTIF_DESCARTADO, '1')
}

function descartarInstall() {
  installDescartado.value = true
  localStorage.setItem(CLAVE_INSTALL_DESCARTADO, '1')
}
</script>

<template>
  <Transition name="banner-generico">
    <div v-if="mostrarAlgo" class="notify-install-banner">
      <div v-if="mostrarNotif" class="fila">
        <div class="texto">
          <p class="titulo">{{ t.chatNotifyPromptTitle }}</p>
          <p class="cuerpo">{{ t.chatNotifyPromptBody }}</p>
        </div>
        <div class="acciones">
          <BaseButton size="sm" @click="pedirPermiso">{{ t.chatNotifyPromptEnable }}</BaseButton>
          <button type="button" class="boton-descartar" @click="descartarNotif">{{ t.promptDismiss }}</button>
        </div>
      </div>

      <span v-if="mostrarNotif && mostrarInstall" class="separador" />

      <div v-if="mostrarInstall" class="fila">
        <div class="texto">
          <p class="titulo">{{ t.installPromptTitle }}</p>
          <p class="cuerpo">{{ esIOS ? t.installPromptBodyIOS : t.installPromptBodyAndroid }}</p>
        </div>
        <div class="acciones">
          <BaseButton v-if="!esIOS" size="sm" @click="instalar">{{ t.installPromptButton }}</BaseButton>
          <button type="button" class="boton-descartar" @click="descartarInstall">{{ t.promptDismiss }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Mismos tokens que ReverifyBanner.vue (tarjeta con esquinas redondeadas) -
   pero a diferencia de ese, este vive directo en .panel-principal (mismo
   slot que KickVoteBanner.vue, que es un banner al ras de los bordes) - sin
   margen propio quedaria una tarjeta redondeada tocando los bordes del
   panel, se ve rota. El margen la separa como "aviso suave" flotante, en
   vez de otra franja mas pegada al borde. */
.notify-install-banner {
  margin: 0.75rem 1.125rem 0;
  padding: 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.texto {
  min-width: 0;
}

.titulo {
  font-size: 0.9375rem;
  color: var(--text-h);
}

.cuerpo {
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.acciones {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.boton-descartar {
  border: none;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  white-space: nowrap;
}

.boton-descartar:hover {
  color: var(--text);
}

/* Mismo patron que HeaderMenu.vue */
.separador {
  height: 1px;
  background: var(--border);
}

@media (max-width: 480px) {
  .fila {
    flex-direction: column;
    align-items: flex-start;
  }

  .acciones {
    align-self: flex-end;
  }
}

.banner-generico-enter-active,
.banner-generico-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.banner-generico-enter-from,
.banner-generico-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
