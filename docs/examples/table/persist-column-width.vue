<template>
  <el-table id="table-column-width-demo" :data="tableData" style="width: 100%">
    <el-table-column prop="date" label="Date" column-key="date" />
    <el-table-column prop="name" label="Name" column-key="name" />
    <el-table-column prop="address" label="Address" column-key="address" />
  </el-table>
</template>

<script setup lang="ts">
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
</script>
