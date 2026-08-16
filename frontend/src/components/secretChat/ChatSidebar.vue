<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { compartirEnlace as compartirEnlaceNativo } from '../../services/secretChat/share.service'
import type { Ocupante } from '../../composables/secretChat/usePresenceCapacity'
import AppLogo from '../ui/AppLogo.vue'
import OccupantList from './OccupantList.vue'

const props = defineProps<{ ocupantes: Ocupante[]; abierto: boolean; objetivoVoto: string | null }>()
const emit = defineEmits<{ cerrar: []; 'iniciar-voto': [clavePresencia: string] }>()

const { t } = useLocale()
const compartido = ref(false)

async function compartirEnlace() {
  const resultado = await compartirEnlaceNativo(window.location.href, t.value.appTitle)
  if (resultado === 'copiado') {
    compartido.value = true
    setTimeout(() => (compartido.value = false), 2000)
  }
}

// Deslizar hacia la izquierda para cerrar (mobile, ver @media abajo) -
// touch-action:pan-y en el CSS deja pasar el scroll vertical nativo de
// OccupantList, solo el arrastre horizontal lo captura este gesto.
const { arrastrando, deltaX, onPointerDown, onPointerMove, onPointerUp, onPointerLeave } = useSwipeGesture({
  direccion: 'izquierda',
  onCommit: () => emit('cerrar'),
})
</script>

<template>
  <aside
    class="chat-sidebar"
    :class="{ abierto }"
    :style="props.abierto && arrastrando ? { transform: `translateX(${deltaX}px)`, transition: 'none' } : undefined"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerLeave"
  >
    <div class="sidebar-header">
      <a href="/" class="marca-mini">
        <AppLogo />
      </a>
      <p class="titulo">{{ t.chatSidebarHeading }}</p>
      <button type="button" class="boton-cerrar" :aria-label="t.chatSidebarCloseAria" @click="emit('cerrar')">
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            d="M5.28 4.22a.75.75 0 00-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 101.06 1.06L10 11.06l4.72 4.72a.75.75 0 101.06-1.06L11.06 10l4.72-4.72a.75.75 0 00-1.06-1.06L10 8.94 5.28 4.22z"
          />
        </svg>
      </button>
    </div>
    <OccupantList :ocupantes="ocupantes" :objetivo-voto="objetivoVoto" @iniciar-voto="emit('iniciar-voto', $event)" />
    <button type="button" class="boton-compartir" @click="compartirEnlace">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.732 3.367a2.5 2.5 0 11-.671 1.341l-6.732-3.367a2.5 2.5 0 110-3.474l6.732-3.367A2.5 2.5 0 0113 4.5z"
        />
      </svg>
      {{ compartido ? t.copiedButton : t.chatShareLinkButton }}
    </button>
  </aside>
</template>

<style scoped>
.chat-sidebar {
  flex-shrink: 0;
  width: 17.5rem;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--bg-surface);
}

.sidebar-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

/* Unico rastro de la marca dentro de una sala - la topbar global de App.vue
   se oculta del todo aca (ver App.vue), asi que el isotipo se muda a este
   header en vez de desaparecer sin dejar rastro. Mismo destino ("/") que
   tenia el logo grande. */
.marca-mini {
  flex-shrink: 0;
  display: flex;
}

.titulo {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.boton-cerrar {
  display: none;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.boton-cerrar svg {
  width: 1.125rem;
  height: 1.125rem;
}

.boton-compartir {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.625rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-h);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.boton-compartir:hover {
  background: var(--bg);
  border-color: var(--accent);
}

.boton-compartir svg {
  width: 1rem;
  height: 1rem;
  color: var(--accent);
}

@media (max-width: 1024px) {
  .chat-sidebar {
    width: 12.5rem;
  }
}

@media (max-width: 480px) {
  .chat-sidebar {
    position: absolute;
    inset: 0;
    width: 100%;
    z-index: 1;
    transform: translateX(-100%);
    transition: transform var(--duration-base) var(--ease-out);
    /* Deja pasar el scroll vertical nativo de OccupantList - solo el
       arrastre horizontal (cerrar deslizando) lo captura el pointer handler
       de arriba, ver useSwipeGesture.ts. */
    touch-action: pan-y;
  }

  .chat-sidebar.abierto {
    transform: translateX(0);
  }

  .boton-cerrar {
    display: flex;
  }
}
</style>
