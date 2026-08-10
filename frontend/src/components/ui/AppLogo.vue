<template>
  <div class="app-logo" aria-hidden="true">
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M10 1a1 1 0 01.372.072l6 2.334A1 1 0 0117 4.333V9c0 4.632-3.16 7.92-6.634 9.94a1 1 0 01-.732 0C6.16 16.92 3 13.632 3 9V4.333a1 1 0 01.628-.927l6-2.334A1 1 0 0110 1zm0 3.5a.75.75 0 01.75.75v2h2a.75.75 0 010 1.5h-2v2a.75.75 0 01-1.5 0v-2h-2a.75.75 0 010-1.5h2v-2A.75.75 0 0110 4.5z"
        clip-rule="evenodd"
      />
    </svg>
  </div>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  border-radius: var(--radius-sm);
  background: var(--accent-gradient);
  box-shadow: var(--shadow-glow-sm);
  color: var(--accent-contrast);
  transition:
    background-color var(--duration-base) var(--ease-out),
    box-shadow var(--duration-base) var(--ease-out);
}

.app-logo svg {
  width: 1.1875rem;
  height: 1.1875rem;
}
</style>
