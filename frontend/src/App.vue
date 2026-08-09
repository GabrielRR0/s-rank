<script setup lang="ts">
import { computed, ref } from 'vue'
import ChatRoomMain from './components/secretChat/ChatRoomMain.vue'
import CreateChatMain from './components/secretChat/CreateChatMain.vue'
import FileSharingMain from './components/fileSharing/FileSharingMain.vue'
import ViewContent from './components/fileSharing/ViewContent.vue'
import AppAvatar from './components/ui/AppAvatar.vue'
import AppFooter from './components/ui/AppFooter.vue'
import AppLogo from './components/ui/AppLogo.vue'
import LanguageToggle from './components/ui/LanguageToggle.vue'
import ThemeToggle from './components/ui/ThemeToggle.vue'
import { apodoActual } from './composables/secretChat/useRoomNickname'
import { useLocale } from './i18n/useLocale'

const { t } = useLocale()

// El avatar solo existe una vez que la persona eligio un apodo para algun
// chat secreto (ver useRoomNickname.ts) - antes de eso no hay ninguna
// identidad que mostrar, asi que el header no muestra nada en su lugar.
const inicialAvatar = computed(() => apodoActual.value.charAt(0).toUpperCase())

// Sin vue-router: esta app resuelve 4 estados por regex sobre la URL, y
// nunca navega entre ellos del lado del cliente - cada uno se llega
// segun como se abrio la pagina (o, en "/", con un toggle puramente local
// sin cambiar la URL), una sola vez por carga. Una libreria de ruteo
// completa seguiria siendo sobredimensionada para esto (mismo criterio que
// contract-generator evitando axios/vue-i18n por pocas necesidades reales).
// vercel.json ya sirve index.html para cualquier ruta no-/api, asi que
// /s/:id y /chat/:id funcionan igual que "/" en produccion.
const shareId = computed(() => window.location.pathname.match(/^\/s\/([^/]+)$/)?.[1] ?? null)
const chatRoomId = computed(() => window.location.pathname.match(/^\/chat\/([^/]+)$/)?.[1] ?? null)

// Solo relevante en "/" (ni shareId ni chatRoomId presentes) - decide entre
// crear un share de archivo o crear una sala de chat secreto. Estado local,
// no afecta la URL: no hay nada que compartir de este toggle en si mismo.
const modoInicio = ref<'compartir' | 'chat'>('compartir')
const indiceModo = computed(() => (modoInicio.value === 'compartir' ? 0 : 1))
</script>

<template>
  <div class="app-shell">
    <!-- Barra superior compacta tipo app (marca + pestañas + controles) en
         vez del hero grande centrado de antes - en el chat, ChatHeader.vue
         (dentro de ChatRoomMain) ya cumple ese rol a pantalla completa. -->
    <header class="app-topbar" :class="{ 'app-topbar--chat': chatRoomId }">
      <div class="marca">
        <AppLogo />
        <span class="marca-nombre">{{ t.appTitle }}</span>
      </div>

      <nav v-if="!shareId" class="tabs-nav" role="tablist">
        <span class="indicador" aria-hidden="true" :style="{ transform: `translateX(${indiceModo * 100}%)` }"></span>
        <button
          type="button"
          class="tab"
          role="tab"
          :aria-selected="modoInicio === 'compartir'"
          :class="{ activo: modoInicio === 'compartir' }"
          @click="modoInicio = 'compartir'"
        >
          <svg class="tab-icono" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 11.586V4a1 1 0 011-1z" />
            <path d="M4 15a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
          </svg>
          <span>{{ t.modeShareTab }}</span>
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          :aria-selected="modoInicio === 'chat'"
          :class="{ activo: modoInicio === 'chat' }"
          @click="modoInicio = 'chat'"
        >
          <svg class="tab-icono" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 4v-4H4a2 2 0 01-2-2V5z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{{ t.modeChatTab }}</span>
        </button>
      </nav>

      <div class="controles-topbar">
        <LanguageToggle />
        <ThemeToggle />
        <AppAvatar v-if="apodoActual" :inicial="inicialAvatar" />
      </div>
    </header>

    <div class="app-content" :class="{ 'app-content--chat': chatRoomId }">
      <ChatRoomMain v-if="chatRoomId" :room-id="chatRoomId" />

      <template v-else>
        <div class="contenido-centrado">
          <ViewContent v-if="shareId" :share-id="shareId" />
          <Transition v-else name="modo-swap" mode="out-in">
            <FileSharingMain v-if="modoInicio === 'compartir'" key="compartir" />
            <CreateChatMain v-else key="chat" />
          </Transition>
        </div>

        <AppFooter />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Marco fijo de 100vh, como una app real - solo .app-content scrollea si
   hace falta, la pagina en si nunca lo hace. Mismo criterio que ya usa
   ChatRoomMain.vue para la sala conectada. */
.app-shell {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

/* Panel de vidrio flotante: position:absolute (no un flex-item mas) para
   que .app-content pueda ocupar todo el alto y su contenido pase "por
   detras" al scrollear - sin superposicion real, el blur no tendria nada
   detras para desenfocar y quedaria decorativo pero invisible. El blur
   necesita los dos prefijos (backdrop-filter y -webkit-) para Safari. */
.app-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  height: 3.625rem;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0 1.25rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
  background: color-mix(in srgb, var(--bg-surface) 62%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.marca {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.marca-nombre {
  font-weight: 700;
  font-size: 0.9375rem;
  color: var(--text-h);
}

.tabs-nav {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  padding: 0.25rem;
  border-radius: 999px;
  background: var(--bg-inset);
  border: 1px solid var(--border);
}

.indicador {
  position: absolute;
  top: 0.25rem;
  bottom: 0.25rem;
  left: 0.25rem;
  width: calc((100% - 0.5rem) / 2);
  border-radius: 999px;
  background: var(--accent-gradient);
  box-shadow: var(--shadow-glow-sm);
  transition: transform var(--duration-base) var(--ease-out);
}

.tab {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  line-height: 1.2;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  min-width: 80px;
  transition: color var(--duration-fast) var(--ease-out);
}

.tab-icono {
  width: 0.8125rem;
  height: 0.8125rem;
  flex-shrink: 0;
}

.tab.activo {
  color: var(--accent-contrast);
}

.controles-topbar {
  flex: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.625rem;
}

/* padding-top = altura de .app-topbar (3.625rem, ahora fuera del flujo
   normal) + el mismo respiro de 2rem que ya tenia antes - preserva la
   posicion visual del contenido tal cual estaba, ahora que el header pasa
   a superponerse en vez de ocupar su propio espacio en el flex. */
.app-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 5.625rem 1.5rem 3rem;
}

.app-content--chat {
  padding: 3.625rem 0 0;
  overflow: hidden;
}

.contenido-centrado {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  animation: fade-in-up var(--duration-base) var(--ease-out) both;
}

@media (max-width: 480px) {
  .app-topbar {
    padding: 0 1rem;
  }

  /* Dentro de una sala esta topbar global desaparece por completo en mobile
     (ChatHeader.vue ya cubre marca/controles ahi) - en tablet y desktop se
     mantiene visible arriba de la sala, ver captura de referencia. */
  .app-topbar.app-topbar--chat {
    display: none;
  }

  /* Sin topbar global visible aca, .app-content--chat no necesita el
     padding-top que reserva su lugar en pantallas mas anchas. */
  .app-content--chat {
    padding-top: 0;
  }

  .controles-topbar {
    gap: 0.5rem;
  }

  .app-content {
    padding: 5.125rem 1rem 2rem;
  }

  /* En mobile todo se mantiene en una sola fila superior en vez de mover
     las pestañas a una barra fija abajo: se suelta el nombre de marca (solo
     queda el isotipo) y las pestañas pasan a ser solo-icono, para que
     entren junto al selector de idioma y el avatar sin competir por
     espacio horizontal. */
  .marca-nombre {
    display: none;
  }

  .tab {
    padding: 0.4375rem;
  }

  .tab span {
    display: none;
  }

  .tab-icono {
    width: 1rem;
    height: 1rem;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Cambio de "Compartir archivo" <-> "Chat secreto": fundido + deslizamiento
   corto, mismo lenguaje visual que fade-in-up de arriba, para que se sienta
   como el mismo contenido "entrando" en vez de un corte instantaneo.
   mode="out-in" evita que ambos contenidos se solapen durante el cambio. */
.modo-swap-enter-active,
.modo-swap-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.modo-swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.modo-swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
