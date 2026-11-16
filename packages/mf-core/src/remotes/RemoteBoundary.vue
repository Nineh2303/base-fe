<script setup lang="ts">
import { computed, getCurrentInstance, inject, onBeforeUnmount, onErrorCaptured, ref, watch } from 'vue'
import { routeLocationKey } from 'vue-router'

const props = withDefaults(defineProps<{ name: string; timeout?: number; error?: Error }>(), {
  timeout: 10000,
})
const emit = defineEmits<{ retry: [] }>()

const caught = ref<Error | null>(null)
const key = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined

// Wrapping <RouterView/>: navigating to another route clears a captured error.
const route = inject(routeLocationKey, null)
if (route) {
  watch(
    () => route.fullPath,
    () => {
      if (caught.value) {
        clearTimer()
        caught.value = null
        key.value++
      }
    },
  )
}

const shown = computed(() => props.error ?? caught.value)

function clearTimer() {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

const appConfig = getCurrentInstance()?.appContext.config

/**
 * Event-handler errors (ErrorCodes NATIVE_EVENT_HANDLER=5 / COMPONENT_EVENT_HANDLER=6) are non-fatal:
 * dev builds pass the type string, prod builds pass `https://vuejs.org/error-reference/#runtime-<code>`.
 */
function isEventHandlerError(info: string): boolean {
  return /event handler$/.test(info) || /#runtime-(5|6)$/.test(info)
}

onErrorCaptured((err, instance, info) => {
  console.error(`[mf-core] remote ${props.name} error`, err)
  // We stop propagation (return false), so forward once to the app handler (Sentry etc.).
  const handler = appConfig?.errorHandler
  if (handler) {
    try {
      handler(err, instance, info)
    } catch (handlerErr) {
      console.error('[mf-core] app errorHandler threw', handlerErr)
    }
  }
  if (!isEventHandlerError(info)) {
    // Setup / render / lifecycle / async-load errors: take over the area.
    clearTimer()
    caught.value = err instanceof Error ? err : new Error(String(err))
  }
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
