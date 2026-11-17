<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, useMfContext, useMfLayout, useTheme } from '@nineh2303/mf-core'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Toaster,
} from '@nineh2303/ui'

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
  <div class="min-h-screen bg-background text-foreground">
    <header v-if="showLayout" class="flex items-center gap-6 border-b border-border px-6 py-3">
      <RouterLink to="/" class="font-semibold">%%name%%</RouterLink>
      <nav class="flex flex-1 gap-4 text-sm">
        <RouterLink
          v-for="r in menu"
          :key="r.name"
          :to="r.routePrefix"
          class="text-muted-foreground hover:text-foreground"
          active-class="font-semibold text-foreground"
        >
          {{ r.menu!.label }}
        </RouterLink>
      </nav>
      <div class="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" @click="toggleTheme">
          {{ theme.mode.value === 'light' ? 'Dark' : 'Light' }}
        </Button>
        <DropdownMenu v-if="isAuthenticated">
          <DropdownMenuTrigger as-child>
            <Button type="button" variant="ghost" size="sm">{{ user?.name }}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{{ user?.name }}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="onLogout">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button v-else as-child size="sm"><RouterLink to="/auth/login">Log in</RouterLink></Button>
      </div>
    </header>
    <main class="p-6">
      <RouterView />
    </main>
    <!-- One Toaster per app: call toast() from the ui package anywhere. -->
    <Toaster />
  </div>
</template>
