<template>
  <el-button type="primary" @click="onClick">隐藏 name 列</el-button>
  <el-table
    id="aabb1"
    ref="tableRef"
    :data="tableData"
    @column-persistence-load="onLoadPersistence"
    @column-persistence-save="onSavePersistence"
  >
    <el-table-column prop="date" sortable label="Date" width="180" />
    <el-table-column prop="name" label="Name" width="180" />
    <el-table-column prop="address" label="Address" />
  </el-table>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const tableRef = ref()
const showName = ref(true)
const onClick = () => {
  showName.value = !showName.value
  tableRef.value.persistColumnVisibility('name', showName.value)
}

const tableData = [
  {
    date: '2016-05-03',
    name: 'Tom',
    address: 'No. 189, Grove St, Los Angeles',
  },
  {
    date: '2016-05-02',
    name: 'Tom',
    address: 'No. 189, Grove St, Los Angeles',
  },
  {
    date: '2016-05-04',
    name: 'Tom',
    address: 'No. 189, Grove St, Los Angeles',
  },
  {
    date: '2016-05-01',
    name: 'Tom',
    address: 'No. 189, Grove St, Los Angeles',
  },
]

// 用一个 Map 模拟外部存储（可替换成接口/IndexedDB 等）
const externalStore = new Map<string, unknown>()

const onLoadPersistence = (
  key: string,
  tableId: string,
  resolve: (payload: any) => void
) => {
  // 返回存储的数据（可直接返回 Promise）
  console.log('onLoadPersistence', externalStore.get(key))
  resolve(externalStore.get(key) || null)
}

const onSavePersistence = (key: string, payload: any) => {
  // 把表格生成的持久化数据写入自定义存储
  externalStore.set(key, payload)
  console.log('onSavePersistence: key', key)
  console.log('onSavePersistence: payload', payload)
}
</script>
