<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CheckboxIndicator, CheckboxRoot, type CheckboxRootEmits, type CheckboxRootProps, useForwardPropsEmits } from 'reka-ui'
import { Check } from 'lucide-vue-next'
import { computed } from 'vue'
import { cn } from '../../lib/utils'

interface Props extends CheckboxRootProps {
  class?: HTMLAttributes['class']
}
const props = defineProps<Props>()
const emits = defineEmits<CheckboxRootEmits>()

const delegated = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    data-slot="checkbox"
    v-bind="forwarded"
    :class="cn('peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', props.class)"
  >
    <CheckboxIndicator data-slot="checkbox-indicator" class="flex items-center justify-center text-current transition-none">
      <slot v-bind="slotProps"><Check class="size-3.5" /></slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
