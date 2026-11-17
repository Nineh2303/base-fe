<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nineh-fe-base/ui'
import { useProductListStore } from '../stores/list'

const store = useProductListStore()
const { items, loading, error } = storeToRefs(store)
const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

onMounted(() => store.fetch())
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="products-title text-primary text-2xl font-semibold" data-test="products-title">Sản phẩm</h1>
    <!-- remote-only responsive class (md:block is not in the shell's css) -->
    <p class="text-muted-foreground hidden text-sm md:block" data-test="products-hint">
      Bấm “Chi tiết” để xem sản phẩm.
    </p>
    <p v-if="loading" data-test="products-loading">Đang tải…</p>
    <p v-else-if="error" class="text-destructive" role="alert" data-test="products-error">
      Không tải được danh sách: {{ error }}
    </p>
    <Table v-else class="min-w-96">
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Tên</TableHead>
          <TableHead class="text-right">Giá</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="p in items" :key="p.id" data-test="product-row">
          <TableCell>{{ p.id }}</TableCell>
          <TableCell>
            {{ p.name }}
            <Badge variant="secondary" class="ml-2">mới</Badge>
          </TableCell>
          <TableCell class="text-right">{{ price.format(p.price) }}</TableCell>
          <TableCell class="text-right">
            <Dialog>
              <DialogTrigger as-child>
                <Button size="sm" data-test="product-detail">Chi tiết</Button>
              </DialogTrigger>
              <DialogContent data-test="product-dialog">
                <DialogHeader>
                  <DialogTitle>{{ p.name }}</DialogTitle>
                  <DialogDescription>Giá: {{ price.format(p.price) }}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button data-test="dialog-confirm">Đặt hàng</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </section>
</template>
