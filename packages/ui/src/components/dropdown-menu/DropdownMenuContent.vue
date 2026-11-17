<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DropdownMenuPortal, DropdownMenuContent, type DropdownMenuContentEmits, type DropdownMenuContentProps, useForwardPropsEmits } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/utils'
import { usePortalTo } from '../../lib/portal'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<DropdownMenuContentProps & { class?: HTMLAttributes['class'] }>(), { sideOffset: 4 })
const emits = defineEmits<DropdownMenuContentEmits>()
const portalTo = usePortalTo()

const delegated = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <DropdownMenuPortal :to="portalTo">
    <DropdownMenuContent data-slot="dropdown-menu-content" v-bind="{ ...$attrs, ...forwarded }" :class="cn('bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 max-h-(--reka-dropdown-menu-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md', props.class)">
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
