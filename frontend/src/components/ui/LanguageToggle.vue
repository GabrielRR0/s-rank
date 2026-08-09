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
  gap: 0.25rem;
  height: 1.5rem;
  padding: 0.125rem 0.3125rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-inset);
  cursor: pointer;
  font: inherit;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition:
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.opcion {
  padding: 0.1875rem 0.4375rem;
  border-radius: 999px;
  color: var(--text-muted);
  transition:
    color var(--duration-base) var(--ease-out),
    background-color var(--duration-base) var(--ease-out);
}

.opcion.activo {
  background: var(--accent-gradient);
  color: var(--accent-contrast);
  box-shadow: var(--shadow-glow-sm);
}

.separador {
  display: none;
}
</style>
