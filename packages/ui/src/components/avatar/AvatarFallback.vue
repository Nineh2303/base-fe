<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { AvatarFallback } from 'reka-ui'
import { cn } from '../../lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <AvatarFallback data-slot="avatar-fallback" :class="cn('bg-muted flex size-full items-center justify-center rounded-full', props.class)">
    <slot />
  </AvatarFallback>
</template>
