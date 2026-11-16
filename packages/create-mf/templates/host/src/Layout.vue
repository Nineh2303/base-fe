<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, useMfContext, useMfLayout, useTheme } from '@nineh-fe-base/mf-core'

const { remotes } = useMfContext()
const { user, isAuthenticated, logout } = useAuth()
const theme = useTheme()
const showLayout = useMfLayout()
const router = useRouter()

const menu = computed(() =>
  remotes.value
    .filter((r) => r.menu)
    .sort((a, b) => (a.menu!.order ?? 0) - (b.menu!.order ?? 0)),
)

function toggleTheme() {
  theme.setMode(theme.mode.value === 'light' ? 'dark' : 'light')
}

async function onLogout() {
  await logout()
  await router.push('/')
}
</script>

<template>
  <div class="shell">
    <header v-if="showLayout" class="shell-header">
      <RouterLink to="/" class="shell-brand">%%name%%</RouterLink>
      <nav class="shell-nav">
        <RouterLink v-for="r in menu" :key="r.name" :to="r.routePrefix">
          {{ r.menu!.label }}
        </RouterLink>
      </nav>
      <div class="shell-actions">
        <button type="button" @click="toggleTheme">
          {{ theme.mode.value === 'light' ? 'Dark' : 'Light' }}
        </button>
        <template v-if="isAuthenticated">
          <span>{{ user?.name }}</span>
          <button type="button" @click="onLogout">Log out</button>
        </template>
        <RouterLink v-else to="/auth/login">Log in</RouterLink>
      </div>
    </header>
    <main class="shell-main">
      <RouterView />
    </main>
  </div>
</template>

<style>
html,
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: var(--mf-color-bg);
  color: var(--mf-color-text);
}
a {
  color: var(--mf-color-primary);
}
button {
  font: inherit;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--mf-color-border);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.shell-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--mf-color-border);
}
.shell-brand {
  font-weight: 600;
  text-decoration: none;
}
.shell-nav {
  display: flex;
  gap: 1rem;
  flex: 1;
}
.shell-nav .router-link-active {
  font-weight: 600;
}
.shell-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.shell-main {
  padding: 1.5rem;
}
</style>
