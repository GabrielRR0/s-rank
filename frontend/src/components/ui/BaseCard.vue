<template>
  <div class="base-card">
    <slot />
  </div>
</template>

<style scoped>
.base-card {
  padding: 2rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  transition:
    box-shadow var(--duration-base) var(--ease-out),
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.base-card:hover {
  box-shadow: var(--shadow-sm);
}

@media (max-width: 480px) {
  .base-card {
    padding: 1.25rem;
  }
}
</style>
