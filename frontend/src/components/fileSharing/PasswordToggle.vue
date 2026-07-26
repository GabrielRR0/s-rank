<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'

const activo = defineModel<boolean>('activo', { required: true })
const password = defineModel<string>('password', { required: true })

const { t } = useLocale()
</script>

<template>
  <div class="password-toggle">
    <div class="fila-switch">
      <button
        type="button"
        class="switch"
        :class="{ activo }"
        role="switch"
        :aria-checked="activo"
        :aria-label="t.passwordToggleLabel"
        @click="activo = !activo"
      >
        <span class="perilla" />
      </button>
      <span class="etiqueta">{{ t.passwordToggleLabel }}</span>
    </div>
    <Transition name="campo-fade">
      <input
        v-if="activo"
        v-model="password"
        type="password"
        class="campo-password"
        :placeholder="t.passwordPlaceholder"
        autocomplete="new-password"
      />
    </Transition>
  </div>
</template>

<style scoped>
.password-toggle {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fila-switch {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.switch {
  position: relative;
  width: 2.25rem;
  height: 1.25rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.switch.activo {
  background: var(--accent);
  border-color: var(--accent);
}

.perilla {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-base) var(--ease-out);
}

.switch.activo .perilla {
  transform: translateX(1rem);
}

.etiqueta {
  font-size: 0.9rem;
  color: var(--text);
}

.campo-password {
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-h);
  font: inherit;
  font-size: 0.9375rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-password:focus {
  outline: none;
  border-color: var(--accent);
}

.campo-fade-enter-active,
.campo-fade-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.campo-fade-enter-from,
.campo-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
