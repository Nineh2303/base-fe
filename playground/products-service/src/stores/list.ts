import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useMfContext } from '@nineh-fe-base/mf-core'

export interface Product {
  id: number
  name: string
  price: number
}

// Store ids of a remote are prefixed with the remote name.
export const useProductListStore = defineStore('products/list', () => {
  // Setup stores run inside the app's injection context, so the shared MfContext is reachable here.
  const { http } = useMfContext()
  const items = ref<Product[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data } = await http.get<Product[]>('/products')
      items.value = data
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, fetch }
})
