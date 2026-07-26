<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'

const { locale, t, alternarLocale } = useLocale()
</script>

<template>
  <button
    type="button"
    class="language-toggle"
    :aria-label="t.languageToggleAria"
    :title="t.languageToggleAria"
    @click="alternarLocale"
  >
    <span class="opcion" :class="{ activo: locale === 'es' }">ES</span>
    <span class="separador">/</span>
    <span class="opcion" :class="{ activo: locale === 'en' }">EN</span>
  </button>
</template>

<style scoped>
.language-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  height: 1.75rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition:
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.opcion {
  color: var(--text-muted);
  transition: color var(--duration-base) var(--ease-out);
}

.opcion.activo {
  color: var(--accent);
}

.separador {
  color: var(--border);
}
</style>
