<script setup lang="ts">
import { Button } from '@nineh2303/ui'
</script>

<template>
  <section class="flex flex-col items-start gap-3" data-test="not-found">
    <h1 class="m-0 text-4xl font-semibold tracking-tight">404</h1>
    <p class="text-muted-foreground m-0">Không tìm thấy trang.</p>
    <Button as-child variant="outline">
      <RouterLink to="/">Về trang chủ</RouterLink>
    </Button>
  </section>
</template>
