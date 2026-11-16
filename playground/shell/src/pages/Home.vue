<script setup lang="ts">
import { useAuth } from '@nineh-fe-base/mf-core'

const { user, isAuthenticated } = useAuth()
</script>

<template>
  <section>
    <h1>Trang chủ</h1>
    <p v-if="isAuthenticated" data-test="welcome">Xin chào, {{ user?.name }}.</p>
    <p v-else>Bạn chưa đăng nhập. <RouterLink to="/auth/login">Đăng nhập</RouterLink></p>
  </section>
</template>
