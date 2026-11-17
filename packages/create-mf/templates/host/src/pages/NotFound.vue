<script setup lang="ts">
import { Button } from '@nineh-fe-base/ui'
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-2xl font-semibold">404</h1>
    <p class="text-muted-foreground">Page not found.</p>
    <Button as-child variant="outline"><RouterLink to="/">Back to home</RouterLink></Button>
  </section>
</template>
