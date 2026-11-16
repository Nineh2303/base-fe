<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    error?: Error
    /** Default "Không tải được <name>". */
    title?: string
    /** Default "Thử lại". */
    retryLabel?: string
  }>(),
  { error: undefined, title: undefined, retryLabel: 'Thử lại' },
)
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    class="mf-critical-error"
    data-test="mf-critical-error"
    role="alert"
    style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:var(--mf-color-bg,#fff);color:var(--mf-color-text,#1f2937);font-family:var(--mf-font-family,system-ui,sans-serif)"
  >
    <h1 style="margin:0;font-size:1.5rem">{{ title ?? `Không tải được ${name}` }}</h1>
    <p v-if="error" style="margin:0;color:var(--mf-color-danger,#dc2626)">{{ error.message }}</p>
    <button
      type="button"
      data-test="mf-retry"
      style="padding:8px 16px;border:0;border-radius:var(--mf-radius,6px);background:var(--mf-color-primary,#2563eb);color:var(--mf-color-on-primary,#fff);cursor:pointer"
      @click="emit('retry')"
    >
      {{ retryLabel }}
    </button>
  </div>
</template>
