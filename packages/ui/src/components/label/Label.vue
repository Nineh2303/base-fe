<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Label, type LabelProps } from 'reka-ui'
import { cn } from '../../lib/utils'

interface Props extends LabelProps {
  class?: HTMLAttributes['class']
}
const props = defineProps<Props>()
</script>

<template>
  <Label
    data-slot="label"
    :for="props.for"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50', props.class)"
  >
    <slot />
  </Label>
</template>
