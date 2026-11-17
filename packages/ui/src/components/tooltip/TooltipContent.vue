<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TooltipPortal, TooltipContent, type TooltipContentEmits, type TooltipContentProps, useForwardPropsEmits, TooltipArrow } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/utils'
import { usePortalTo } from '../../lib/portal'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>(), { sideOffset: 4 })
const emits = defineEmits<TooltipContentEmits>()
const portalTo = usePortalTo()

const delegated = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <TooltipPortal :to="portalTo">
    <TooltipContent data-slot="tooltip-content" v-bind="{ ...$attrs, ...forwarded }" :class="cn('bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance', props.class)">
      <slot />
      <TooltipArrow class="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
    </TooltipContent>
  </TooltipPortal>
</template>
