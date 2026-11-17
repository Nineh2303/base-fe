<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { AvatarImage, type AvatarImageProps } from 'reka-ui'
import { cn } from '../../lib/utils'

interface Props extends AvatarImageProps {
  class?: HTMLAttributes['class']
}
const props = defineProps<Props>()
</script>

<template>
  <AvatarImage data-slot="avatar-image" :src="props.src" :class="cn('aspect-square size-full', props.class)" />
</template>
