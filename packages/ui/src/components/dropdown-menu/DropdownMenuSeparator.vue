<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DropdownMenuSeparator, type DropdownMenuSeparatorProps, useForwardProps } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps<DropdownMenuSeparatorProps & { class?: HTMLAttributes['class'] }>()
const delegated = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <DropdownMenuSeparator data-slot="dropdown-menu-separator" v-bind="forwarded" :class="cn('bg-border -mx-1 my-1 h-px', props.class)"><slot /></DropdownMenuSeparator>
</template>
