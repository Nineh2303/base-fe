<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { AvatarImage, type AvatarImageEmits, type AvatarImageProps, useForwardPropsEmits } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/utils'

interface Props extends AvatarImageProps {
  class?: HTMLAttributes['class']
}
const props = defineProps<Props>()
const emits = defineEmits<AvatarImageEmits>()

const delegated = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <AvatarImage data-slot="avatar-image" v-bind="forwarded" :class="cn('aspect-square size-full', props.class)" />
</template>
