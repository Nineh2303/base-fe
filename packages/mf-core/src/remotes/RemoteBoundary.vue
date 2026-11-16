<script setup lang="ts">
import { computed, onBeforeUnmount, onErrorCaptured, ref } from 'vue'

const props = withDefaults(defineProps<{ name: string; timeout?: number; error?: Error }>(), {
  timeout: 10000,
})
const emit = defineEmits<{ retry: [] }>()

const caught = ref<Error | null>(null)
const key = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined

const shown = computed(() => props.error ?? caught.value)

function clearTimer() {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

onErrorCaptured((err) => {
  clearTimer()
  caught.value = err instanceof Error ? err : new Error(String(err))
  return false
})

function onPending() {
  clearTimer()
  if (props.timeout > 0) {
    timer = setTimeout(() => {
      caught.value = new Error(`Timeout: ${props.name} did not load within ${props.timeout}ms`)
    }, props.timeout)
  }
}

function retry() {
  clearTimer()
  caught.value = null
  key.value++
  emit('retry')
}

onBeforeUnmount(clearTimer)
</script>

<template>
  <div
    v-if="shown"
    class="mf-remote-error"
    role="alert"
    style="padding:16px;border:1px solid var(--mf-color-danger,#dc2626);border-radius:var(--mf-radius,6px);color:var(--mf-color-text,#1f2937);background:var(--mf-color-bg,#fff)"
  >
    <strong>Không tải được {{ name }}</strong>
    <p style="margin:8px 0;color:var(--mf-color-danger,#dc2626)">{{ shown.message }}</p>
    <button
      type="button"
      data-test="mf-retry"
      style="padding:6px 12px;border:0;border-radius:var(--mf-radius,6px);background:var(--mf-color-primary,#2563eb);color:var(--mf-color-on-primary,#fff);cursor:pointer"
      @click="retry"
    >
      Thử lại
    </button>
  </div>
  <Suspense v-else :key="key" @pending="onPending" @resolve="clearTimer">
    <slot />
    <template #fallback><span class="mf-remote-loading" /></template>
  </Suspense>
</template>
