<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'
import type { EstadoConexion } from '../../composables/secretChat/usePresenceCapacity'
import ConnectingIndicator from './ConnectingIndicator.vue'

defineProps<{ estado: EstadoConexion }>()

const { t } = useLocale()
</script>

<template>
  <div class="capacity-gate">
    <ConnectingIndicator v-if="estado === 'conectando'" :texto="t.chatConnectingText" />

    <template v-else-if="estado === 'sala-llena'">
      <h2>{{ t.chatRoomFullHeading }}</h2>
      <p class="subtitulo">{{ t.chatRoomFullSubtitle }}</p>
    </template>

    <template v-else-if="estado === 'error'">
      <h2>{{ t.chatConnectionErrorHeading }}</h2>
      <p class="subtitulo">{{ t.chatConnectionErrorSubtitle }}</p>
    </template>
  </div>
</template>

<style scoped>
.subtitulo {
  color: var(--text-muted);
  font-size: 0.9375rem;
}
</style>
