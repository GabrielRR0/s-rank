<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'

const props = defineProps<{ archivo: File | null }>()
const emit = defineEmits<{ 'update:archivo': [File | null] }>()

const { t } = useLocale()
const arrastrando = ref(false)

function onDrop(evento: DragEvent) {
  arrastrando.value = false
  const file = evento.dataTransfer?.files?.[0]
  if (file) emit('update:archivo', file)
}

function onChange(evento: Event) {
  const file = (evento.target as HTMLInputElement).files?.[0]
  emit('update:archivo', file ?? null)
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <label
    class="upload-zone"
    :class="{ arrastrando, 'tiene-archivo': !!props.archivo }"
    @dragover.prevent="arrastrando = true"
    @dragleave.prevent="arrastrando = false"
    @drop.prevent="onDrop"
  >
    <input type="file" class="input-oculto" @change="onChange" />
    <template v-if="!props.archivo">
      <span class="icono" aria-hidden="true">↑</span>
      <p class="texto-principal">{{ t.uploadDragLabel }}</p>
      <p class="texto-secundario">{{ t.uploadMaxSizeLabel }}</p>
    </template>
    <template v-else>
      <p class="texto-principal">{{ props.archivo.name }}</p>
      <p class="texto-secundario">{{ formatearTamano(props.archivo.size) }}</p>
      <button type="button" class="quitar" @click.prevent="emit('update:archivo', null)">
        {{ t.uploadRemove }}
      </button>
    </template>
  </label>
</template>

<style scoped>
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 2.5rem 1.5rem;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-lg);
  text-align: center;
  cursor: pointer;
  transition:
    border-color var(--duration-base) var(--ease-out),
    background-color var(--duration-base) var(--ease-out);
}

.upload-zone:hover,
.upload-zone.arrastrando {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.upload-zone.tiene-archivo {
  border-style: solid;
}

.input-oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.icono {
  font-size: 1.5rem;
  color: var(--accent);
}

.texto-principal {
  font-size: 0.95rem;
  color: var(--text-h);
  word-break: break-all;
}

.texto-secundario {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.quitar {
  margin-top: 0.25rem;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.quitar:hover {
  opacity: 0.8;
}
</style>
