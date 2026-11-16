<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useProductListStore } from '../stores/list'
import '../products.css'

const store = useProductListStore()
const { items, loading, error } = storeToRefs(store)
const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

onMounted(() => store.fetch())
</script>

<template>
  <section>
    <h1 class="products-title" data-test="products-title">Sản phẩm</h1>
    <p v-if="loading" data-test="products-loading">Đang tải…</p>
    <p v-else-if="error" role="alert" data-test="products-error">Không tải được danh sách: {{ error }}</p>
    <table v-else class="products-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Tên</th>
          <th>Giá</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in items" :key="p.id" data-test="product-row">
          <td>{{ p.id }}</td>
          <td>{{ p.name }}</td>
          <td class="price">{{ price.format(p.price) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
