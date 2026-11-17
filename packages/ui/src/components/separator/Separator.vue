<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Separator, type SeparatorProps } from 'reka-ui'
import { cn } from '../../lib/utils'

interface Props extends SeparatorProps {
  class?: HTMLAttributes['class']
}
const props = withDefaults(defineProps<Props>(), { orientation: 'horizontal', decorative: true })
</script>

<template>
  <Separator
    data-slot="separator"
    :orientation="props.orientation"
    :decorative="props.decorative"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px', props.class)"
  />
</template>
