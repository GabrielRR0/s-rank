<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useTurnstile } from '../../composables/useTurnstile'

const emit = defineEmits<{ token: [string | null] }>()

const contenedor = ref<HTMLElement | null>(null)
const { token, montarEn, reset } = useTurnstile()

onMounted(() => {
  if (contenedor.value) montarEn(contenedor.value)
})

watch(token, (nuevo) => emit('token', nuevo))

// Expuesto para que el formulario que lo contiene pueda pedir un token
// nuevo tras un fallo de servidor (ver useTurnstile.ts) - el padre necesita
// una referencia de template a este componente para poder llamarlo.
defineExpose({ reset })
</script>

<template>
  <div ref="contenedor" class="turnstile-widget" />
</template>

<style scoped>
.turnstile-widget {
  min-height: 65px;
}
</style>
