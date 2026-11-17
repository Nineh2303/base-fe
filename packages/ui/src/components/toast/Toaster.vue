<script setup lang="ts">
import { computed } from 'vue'
import { Toaster as Sonner, type ToasterProps } from 'vue-sonner'
import { usePortalTo } from '../../lib/portal'

defineOptions({ inheritAttrs: false })
const props = defineProps<ToasterProps>()
const portalTo = usePortalTo()
// vue-sonner renders in place (no teleport), so mount it into the scope's portal element explicitly.
const to = computed(() => portalTo.value)
</script>

<template>
  <Teleport :to="to">
    <Sonner class="toaster group" v-bind="{ ...$attrs, ...props }" />
  </Teleport>
</template>
