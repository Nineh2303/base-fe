<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@nineh-fe-base/mf-core'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@nineh-fe-base/ui'

const { t } = useI18n()
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
  <Card class="max-w-sm">
    <CardHeader>
      <CardTitle>{{ t('auth.title') }}</CardTitle>
    </CardHeader>
    <CardContent>
      <form class="flex flex-col gap-3" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-1.5">
          <Label for="auth-username">{{ t('auth.username') }}</Label>
          <Input id="auth-username" v-model="username" data-test="username" autocomplete="username" required />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="auth-password">{{ t('auth.password') }}</Label>
          <Input
            id="auth-password"
            v-model="password"
            data-test="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>
        <p v-if="error" class="text-destructive m-0 text-sm" role="alert" data-test="login-error">{{ t('auth.error') }}</p>
        <Button type="submit" data-test="submit" :disabled="pending">{{ t('auth.submit') }}</Button>
      </form>
    </CardContent>
  </Card>
</template>
