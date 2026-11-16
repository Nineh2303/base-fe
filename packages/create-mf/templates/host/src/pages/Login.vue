<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@nineh-fe-base/mf-core'

const { login } = useAuth()
const route = useRoute()
const router = useRouter()

const username = ref('')
const password = ref('')
const error = ref(false)
const pending = ref(false)

async function onSubmit() {
  error.value = false
  pending.value = true
  try {
    await login({ username: username.value, password: password.value })
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/')
  } catch {
    error.value = true
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <h1>Log in</h1>
    <p>
      <label>Username <input v-model="username" autocomplete="username" required /></label>
    </p>
    <p>
      <label>Password <input v-model="password" type="password" autocomplete="current-password" required /></label>
    </p>
    <p v-if="error" role="alert">Login failed. Check your credentials and that the /api auth backend is running.</p>
    <button type="submit" :disabled="pending">Log in</button>
  </form>
</template>
