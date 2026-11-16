import { defineStore } from 'pinia'
import { ref } from 'vue'

// Store ids of a remote are prefixed with the remote name: `<remote>/<store>`.
export const useSampleStore = defineStore('{{name}}/sample', () => {
  const count = ref(0)

  function increment(): void {
    count.value++
  }

  return { count, increment }
})
