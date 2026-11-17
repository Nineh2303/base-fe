<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuth } from '@nineh2303/mf-core'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nineh2303/ui'
import { useSampleStore } from '../stores/sample'

const store = useSampleStore()
const { count } = storeToRefs(store)
const { user } = useAuth()
</script>

<template>
  <Card class="max-w-md">
    <CardHeader>
      <CardTitle>%%name%%</CardTitle>
      <CardDescription>{{ user ? `Signed in as ${user.name}.` : 'Not signed in.' }}</CardDescription>
    </CardHeader>
    <CardContent>
      <Button type="button" @click="store.increment()">Clicked {{ count }} times</Button>
    </CardContent>
  </Card>
</template>
