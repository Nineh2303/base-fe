<script setup lang="ts">
import { Button } from '@nineh-fe-base/ui'
</script>

<template>
  <section class="flex flex-col items-start gap-3" data-test="forbidden">
    <h1 class="m-0 text-4xl font-semibold tracking-tight">403</h1>
    <p class="text-muted-foreground m-0">Bạn không có quyền truy cập trang này.</p>
    <Button as-child variant="outline">
      <RouterLink to="/">Về trang chủ</RouterLink>
    </Button>
  </section>
</template>
