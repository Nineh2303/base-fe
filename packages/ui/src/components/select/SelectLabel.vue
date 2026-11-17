<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { SelectLabel, type SelectLabelProps, useForwardProps } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps<SelectLabelProps & { class?: HTMLAttributes['class'] }>()
const delegated = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <SelectLabel data-slot="select-label" v-bind="forwarded" :class="cn('text-muted-foreground px-2 py-1.5 text-xs', props.class)"><slot /></SelectLabel>
</template>
