<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@nineh-fe-base/mf-core'

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
  <form class="auth-login" @submit.prevent="onSubmit">
    <h1>{{ t('auth.title') }}</h1>
    <label>
      {{ t('auth.username') }}
      <input v-model="username" data-test="username" autocomplete="username" required />
    </label>
    <label>
      {{ t('auth.password') }}
      <input v-model="password" data-test="password" type="password" autocomplete="current-password" required />
    </label>
    <p v-if="error" class="auth-error" role="alert" data-test="login-error">{{ t('auth.error') }}</p>
    <button type="submit" data-test="submit" :disabled="pending">{{ t('auth.submit') }}</button>
  </form>
</template>

<style scoped>
.auth-login {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 20rem;
}
.auth-login label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.auth-login input {
  font: inherit;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--mf-color-border);
  border-radius: 4px;
  background: var(--mf-color-bg);
  color: var(--mf-color-text);
}
.auth-error {
  margin: 0;
  color: #dc2626;
}
</style>
