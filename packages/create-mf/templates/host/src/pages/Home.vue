<script setup lang="ts">
import { useAuth } from '@nineh2303/mf-core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nineh2303/ui'

const { user, isAuthenticated } = useAuth()
</script>

<template>
  <Card class="max-w-md">
    <CardHeader>
      <CardTitle>Home</CardTitle>
      <CardDescription>Welcome to %%name%%.</CardDescription>
    </CardHeader>
    <CardContent>
      <p v-if="isAuthenticated">Welcome, {{ user?.name }}.</p>
      <p v-else class="text-muted-foreground">You are not signed in.</p>
    </CardContent>
  </Card>
</template>
