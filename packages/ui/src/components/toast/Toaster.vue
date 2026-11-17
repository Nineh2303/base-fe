<script setup lang="ts">
import { Toaster as Sonner } from 'vue-sonner'
import { usePortalTo } from '../../lib/portal'

// No defineProps: declaring vue-sonner's boolean props here would cast omitted ones to false and
// override its defaults. Everything is forwarded as attrs, so only what the caller passes reaches it.
// vue-sonner renders in place (no teleport), so mount it into the scope's portal element explicitly.
const portalTo = usePortalTo()
</script>

<template>
  <Teleport :to="portalTo">
    <Sonner class="toaster group" />
  </Teleport>
</template>
