<template>
  <div class="app-logo" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="7" cy="12" r="2.6" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.4" />
      <circle cx="17" cy="6.5" r="2.6" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.4" />
      <circle cx="17" cy="17.5" r="2.6" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.4" />
      <path d="M9.3 10.7l5.2-3.1M9.3 13.3l5.2 3.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
  </div>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-contrast);
  transition: background-color var(--duration-base) var(--ease-out);
}

.app-logo svg {
  width: 1.375rem;
  height: 1.375rem;
}
</style>
