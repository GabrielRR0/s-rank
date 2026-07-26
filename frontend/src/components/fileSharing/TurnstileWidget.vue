<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useTurnstile } from '../../composables/fileSharing/useTurnstile'

const emit = defineEmits<{ token: [string | null] }>()

const contenedor = ref<HTMLElement | null>(null)
const { token, montarEn } = useTurnstile()

onMounted(() => {
  if (contenedor.value) montarEn(contenedor.value)
})

watch(token, (nuevo) => emit('token', nuevo))
</script>

<template>
  <div ref="contenedor" class="turnstile-widget" />
</template>

<style scoped>
.turnstile-widget {
  min-height: 65px;
}
</style>
