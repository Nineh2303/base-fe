<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DropdownMenuLabel, type DropdownMenuLabelProps, useForwardProps } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps<DropdownMenuLabelProps & { class?: HTMLAttributes['class']; inset?: boolean }>()
const delegated = computed(() => {
  const { class: _c, inset: _i, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <DropdownMenuLabel data-slot="dropdown-menu-label" :data-inset="inset ? '' : undefined" v-bind="forwarded" :class="cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', props.class)"><slot /></DropdownMenuLabel>
</template>
