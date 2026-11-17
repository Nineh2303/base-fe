<script setup lang="ts">
import { useAuth } from '@nineh-fe-base/mf-core'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@nineh-fe-base/ui'

const { user, isAuthenticated } = useAuth()
</script>

<template>
  <section>
    <Card class="max-w-xl">
      <CardHeader>
        <CardTitle class="text-2xl">Trang chủ</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <p v-if="isAuthenticated" class="m-0" data-test="welcome">Xin chào, {{ user?.name }}.</p>
        <template v-else>
          <p class="text-muted-foreground m-0">Bạn chưa đăng nhập.</p>
          <div>
            <Button as-child variant="link" class="px-0">
              <RouterLink to="/auth/login">Đăng nhập</RouterLink>
            </Button>
          </div>
        </template>
      </CardContent>
    </Card>
  </section>
</template>
