<script setup lang="ts">
import { computed } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import HeaderMenu from '../ui/HeaderMenu.vue'

const props = defineProps<{
  ocupantes: number
  capacidadMaxima: number
  nombresEscribiendo: string[]
}>()
defineEmits<{ 'abrir-sidebar': [] }>()

const { t } = useLocale()

const escribiendo = computed(() => props.nombresEscribiendo.length > 0)

const subtitulo = computed(() => {
  if (props.nombresEscribiendo.length === 1) {
    return t.value.chatTypingSingular.replace('{apodo}', props.nombresEscribiendo[0])
  }
  if (props.nombresEscribiendo.length > 1) {
    return t.value.chatTypingPlural.replace('{apodos}', props.nombresEscribiendo.join(', '))
  }
  return t.value.chatHeaderOccupants
    .replace('{ocupantes}', String(props.ocupantes))
    .replace('{capacidad}', String(props.capacidadMaxima))
})

// Mismo patron que App.vue: sin ruteo del lado del cliente, "salir" es
// navegar de verdad de vuelta a "/". La topbar global (donde vivia este
// menu antes) se oculta del todo dentro de una sala, asi que ahora vive
// directamente aca - siempre relevante en este componente (ChatHeader solo
// se renderiza estando en una sala).
function salirDeLaSala() {
  window.location.href = '/'
}
</script>

<template>
  <header class="chat-header">
    <!-- Solo relevante en mobile - en tablet/desktop el sidebar ya esta
         siempre visible al lado, ver ChatRoomConnected.vue. -->
    <button
      type="button"
      class="boton-ocupantes"
      :aria-label="t.chatSidebarOpenAria"
      @click="$emit('abrir-sidebar')"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <div class="icono-candado" aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10 1a4 4 0 00-4 4v2H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 6V5a2 2 0 10-4 0v2h4zm-2 4a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
    <div class="info">
      <p class="titulo">{{ t.chatHeaderTitle }}</p>
      <p class="subtitulo" :class="{ escribiendo }">{{ subtitulo }}</p>
    </div>

    <!-- Chip decorativo (sin cronometro real - no existe un TTL de sala en
         el backend, solo TTL por mensaje, ver useCreateChat/useRoomSession)
         - solo confirma que el enlace de esta sala sigue activo. -->
    <span class="chip-enlace">{{ t.chatHeaderLinkBadge }}</span>

    <HeaderMenu :mostrar-salir="true" @salir="salirDeLaSala" />
  </header>
</template>

<style scoped>
.chat-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.125rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}

.icono-candado {
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-surface));
  color: var(--accent);
}

.icono-candado svg {
  width: 1.125rem;
  height: 1.125rem;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chip-enlace {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.titulo {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitulo {
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitulo.escribiendo {
  color: var(--accent);
}

.boton-ocupantes {
  display: none;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.boton-ocupantes svg {
  width: 1.25rem;
  height: 1.25rem;
}

@media (max-width: 480px) {
  .boton-ocupantes {
    display: flex;
  }
}
</style>
