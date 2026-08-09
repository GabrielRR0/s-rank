<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'

const { t } = useLocale()
</script>

<template>
  <div class="kicked-gate">
    <h2>{{ t.kickedHeading }}</h2>
    <p class="subtitulo">{{ t.kickedSubtitle }}</p>
  </div>
</template>

<style scoped>
.subtitulo {
  color: var(--text-muted);
  font-size: 0.9375rem;
}
</style>
