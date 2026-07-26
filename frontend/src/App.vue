<script setup lang="ts">
import { computed } from 'vue'
import FileSharingMain from './components/fileSharing/FileSharingMain.vue'
import ViewContent from './components/fileSharing/ViewContent.vue'
import AppFooter from './components/ui/AppFooter.vue'
import AppLogo from './components/ui/AppLogo.vue'
import LanguageToggle from './components/ui/LanguageToggle.vue'
import ThemeToggle from './components/ui/ThemeToggle.vue'
import { useLocale } from './i18n/useLocale'

const { t } = useLocale()

// Sin vue-router: esta app tiene solo dos "pantallas" (crear un share en
// "/", verlo en "/s/:id") y nunca se navega entre ellas del lado del
// cliente - se llega a una o a la otra segun como se abrio la pagina, una
// sola vez por carga. Una libreria de ruteo completa seria sobredimensionada
// para esto (mismo criterio que contract-generator evitando axios/vue-i18n
// por pocas necesidades reales). vercel.json ya sirve index.html para
// cualquier ruta no-/api, asi que /s/:id funciona igual que "/" en produccion.
const shareId = computed(() => window.location.pathname.match(/^\/s\/([^/]+)$/)?.[1] ?? null)
</script>

<template>
  <main>
    <div class="controles-flotantes">
      <LanguageToggle />
      <ThemeToggle />
    </div>
    <header class="page-header">
      <AppLogo class="logo" />
      <h1>{{ t.appTitle }}</h1>
      <p class="subtitle">{{ t.appSubtitle }}</p>
    </header>
    <ViewContent v-if="shareId" :share-id="shareId" />
    <FileSharingMain v-else />
    <AppFooter />
  </main>
</template>

<style scoped>
main {
  position: relative;
  min-height: 100vh;
  padding: 4rem 1.5rem 6rem;
}

.controles-flotantes {
  position: absolute;
  top: 2rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.page-header {
  max-width: 640px;
  margin: 0 auto 3rem;
  text-align: center;
  animation: fade-in-up var(--duration-base) var(--ease-out) both;
}

.logo {
  margin: 0 auto 1.25rem;
}

.page-header h1 {
  font-size: clamp(1.75rem, 6vw, 2.75rem);
}

.subtitle {
  margin-top: 0.75rem;
  color: var(--text-muted);
  font-size: 1.0625rem;
}

@media (max-width: 480px) {
  main {
    padding: 3.5rem 1rem 4rem;
  }

  .controles-flotantes {
    top: 1.25rem;
    right: 1rem;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .subtitle {
    font-size: 0.9375rem;
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
</style>
