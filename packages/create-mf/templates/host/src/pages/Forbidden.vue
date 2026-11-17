<script setup lang="ts">
import { Button } from '@nineh2303/ui'
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-2xl font-semibold">403</h1>
    <p class="text-muted-foreground">You do not have permission to view this page.</p>
    <Button as-child variant="outline"><RouterLink to="/">Back to home</RouterLink></Button>
  </section>
</template>
