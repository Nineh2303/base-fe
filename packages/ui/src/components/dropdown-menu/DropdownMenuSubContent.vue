<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DropdownMenuPortal, DropdownMenuSubContent, type DropdownMenuSubContentEmits, type DropdownMenuSubContentProps, useForwardPropsEmits } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/utils'
import { usePortalTo } from '../../lib/portal'

defineOptions({ inheritAttrs: false })
const props = defineProps<DropdownMenuSubContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DropdownMenuSubContentEmits>()
const portalTo = usePortalTo()

const delegated = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <DropdownMenuPortal :to="portalTo">
    <DropdownMenuSubContent data-slot="dropdown-menu-sub-content" v-bind="{ ...$attrs, ...forwarded }" :class="cn('bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg', props.class)">
      <slot />
    </DropdownMenuSubContent>
  </DropdownMenuPortal>
</template>
