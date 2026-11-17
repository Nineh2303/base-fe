<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../lib/utils'
import { badgeVariants, type BadgeVariants } from './badgeVariants'

const props = defineProps<{
  variant?: BadgeVariants['variant']
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div data-slot="badge" :class="cn(badgeVariants({ variant: props.variant }), props.class)">
    <slot />
  </div>
</template>
