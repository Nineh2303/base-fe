<script setup lang="ts">
import { useAuth } from '@nineh-fe-base/mf-core'

const { user, isAuthenticated } = useAuth()
</script>

<template>
  <section>
    <h1>Home</h1>
    <p v-if="isAuthenticated">Welcome, {{ user?.name }}.</p>
    <p v-else>You are not signed in.</p>
  </section>
</template>
