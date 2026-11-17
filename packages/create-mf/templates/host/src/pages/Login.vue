<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@nineh2303/mf-core'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@nineh2303/ui'

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
  <Card class="mx-auto max-w-sm">
    <CardHeader>
      <CardTitle>Log in</CardTitle>
    </CardHeader>
    <CardContent>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="username">Username</Label>
          <Input id="username" v-model="username" autocomplete="username" required />
        </div>
        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input id="password" v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <p v-if="error" role="alert" class="text-sm text-destructive">
          Login failed. Check your credentials and that the /api auth backend is running.
        </p>
        <Button type="submit" class="w-full" :disabled="pending">Log in</Button>
      </form>
    </CardContent>
  </Card>
</template>
