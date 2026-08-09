<script setup lang="ts">
defineProps<{ inicial: string }>()
</script>

<template>
  <span class="app-avatar" aria-hidden="true">{{ inicial }}</span>
</template>

<style scoped>
.app-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--accent-gradient);
  box-shadow: var(--shadow-glow-sm);
  color: var(--accent-contrast);
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
  transition:
    background-color var(--duration-base) var(--ease-out),
    box-shadow var(--duration-base) var(--ease-out);
}
</style>
