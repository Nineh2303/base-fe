<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { SwitchRoot, SwitchThumb, type SwitchRootEmits, type SwitchRootProps, useForwardPropsEmits } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/utils'

interface Props extends SwitchRootProps {
  class?: HTMLAttributes['class']
}
const props = defineProps<Props>()
const emits = defineEmits<SwitchRootEmits>()

const delegated = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <SwitchRoot
    data-slot="switch"
    v-bind="forwarded"
    :class="cn('peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', props.class)"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      class="bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
    />
  </SwitchRoot>
</template>
