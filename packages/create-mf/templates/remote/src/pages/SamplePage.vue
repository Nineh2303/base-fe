<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuth } from '@nineh-fe-base/mf-core'
import { useSampleStore } from '../stores/sample'

const store = useSampleStore()
const { count } = storeToRefs(store)
const { user } = useAuth()
</script>

<template>
  <section>
    <h1>{{name}}</h1>
    <p>Signed in as {{ user?.name }}.</p>
    <button type="button" @click="store.increment()">Clicked {{ count }} times</button>
  </section>
</template>
