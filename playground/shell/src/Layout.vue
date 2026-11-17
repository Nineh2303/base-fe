<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, useMfContext, useMfLayout, useTheme } from '@nineh-fe-base/mf-core'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Toaster,
} from '@nineh-fe-base/ui'

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
  <div class="bg-background text-foreground min-h-screen font-sans">
    <header
      v-if="showLayout"
      class="bg-background flex items-center gap-6 border-b px-6 py-3"
      data-test="shell-header"
    >
      <RouterLink to="/" class="font-semibold no-underline">MF Playground</RouterLink>
      <nav class="flex flex-1 gap-4">
        <RouterLink
          v-for="r in menu"
          :key="r.name"
          :to="r.routePrefix"
          class="text-sm [&.router-link-active]:font-semibold"
          :data-test="`menu-${r.name}`"
        >
          {{ r.menu!.label }}
        </RouterLink>
      </nav>
      <div class="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" data-test="theme-toggle" @click="toggleTheme">
          {{ theme.mode.value === 'light' ? 'Tối' : 'Sáng' }}
        </Button>
        <template v-if="isAuthenticated">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button type="button" variant="ghost" size="sm" data-test="user-menu">
                <span data-test="user-name">{{ user?.name }}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-test="user-menu-logout" @select="onLogout">Đăng xuất</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" size="sm" data-test="logout" @click="onLogout">Đăng xuất</Button>
        </template>
        <RouterLink v-else to="/auth/login" data-test="login-link">Đăng nhập</RouterLink>
      </div>
    </header>
    <main class="p-6">
      <RouterView />
    </main>
    <Toaster />
  </div>
</template>
