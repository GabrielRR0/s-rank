<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'

const LINKEDIN_URL = 'https://www.linkedin.com/in/gabrodriguez1114/'

const { t } = useLocale()
</script>

<template>
  <footer class="app-footer">
    <a
      class="enlace-linkedin"
      :href="LINKEDIN_URL"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="t.linkedinAria"
      :title="t.linkedinTitle"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path
          d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.11 20.45H3.56V9h3.55v11.45Z"
        />
      </svg>
    </a>
  </footer>
</template>

<style scoped>
.app-footer {
  display: flex;
  justify-content: center;
  padding: 2rem 0 0;
}

.enlace-linkedin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  color: var(--text-muted);
  opacity: 0.55;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-base) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.enlace-linkedin svg {
  width: 1.125rem;
  height: 1.125rem;
}

.enlace-linkedin:hover {
  opacity: 1;
  color: var(--accent);
  transform: translateY(-1px);
}
</style>
