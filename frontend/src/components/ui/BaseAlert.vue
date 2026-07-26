<script setup lang="ts">
defineProps<{ mensajes: string[] }>()
</script>

<template>
  <Transition name="alert-fade">
    <div v-if="mensajes.length" class="base-alert" role="alert">
      <svg class="icono" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.28 11.164c.75 1.334-.213 2.987-1.744 2.987H3.72c-1.53 0-2.493-1.653-1.743-2.987L8.257 3.1zM10 7a1 1 0 011 1v3a1 1 0 11-2 0V8a1 1 0 011-1zm0 8a1.125 1.125 0 100-2.25A1.125 1.125 0 0010 15z"
          clip-rule="evenodd"
        />
      </svg>
      <p v-if="mensajes.length === 1">{{ mensajes[0] }}</p>
      <ul v-else>
        <li v-for="mensaje in mensajes" :key="mensaje">{{ mensaje }}</li>
      </ul>
    </div>
  </Transition>
</template>

<style scoped>
.base-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--alert-border);
  background: var(--alert-bg);
  color: var(--alert-text);
  font-size: 0.875rem;
  line-height: 1.5;
}

.icono {
  width: 1.125rem;
  height: 1.125rem;
  min-width: 1.125rem;
  margin-top: 0.0625rem;
}

.base-alert p,
.base-alert ul {
  margin: 0;
}

.base-alert ul {
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.alert-fade-enter-active,
.alert-fade-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
