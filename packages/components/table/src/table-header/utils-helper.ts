import { computed, inject, shallowRef, watch } from 'vue'
import { isClient } from '@element-plus/utils'
import { TABLE_INJECTION_KEY } from '../tokens'

import type { DefaultRow, Table, TableProps } from '../table/defaults'
import type { TableColumnCtx } from '../table-column/defaults'
import type { TableHeaderProps } from '.'
import type { Store } from '../store'

const getAllColumns = <T extends DefaultRow>(
  columns: TableColumnCtx<T>[]
): TableColumnCtx<T>[] => {
  const result: TableColumnCtx<T>[] = []
  columns.forEach((column) => {
    if (column.children) {
      result.push(column)
      // eslint-disable-next-line prefer-spread
      result.push.apply(result, getAllColumns(column.children))
    } else {
      result.push(column)
    }
  })
  return result
}

export const convertToRows = <T extends DefaultRow>(
  originColumns: TableColumnCtx<T>[]
): TableColumnCtx<T>[][] => {
  let maxLevel = 1
  const traverse = (column: TableColumnCtx<T>, parent?: TableColumnCtx<T>) => {
    if (parent) {
      column.level = parent.level + 1
      if (maxLevel < column.level) {
        maxLevel = column.level
      }
    }
    if (column.children) {
      let colSpan = 0
      column.children.forEach((subColumn) => {
        traverse(subColumn, column)
        colSpan += subColumn.colSpan
      })
      column.colSpan = colSpan
    } else {
      column.colSpan = 1
    }
  }

  originColumns.forEach((column) => {
    column.level = 1
    traverse(column, undefined)
  })

  const rows: TableColumnCtx<T>[][] = []
  for (let i = 0; i < maxLevel; i++) {
    rows.push([])
  }

  const allColumns: TableColumnCtx<T>[] = getAllColumns(originColumns)

  allColumns.forEach((column) => {
    if (!column.children) {
      column.rowSpan = maxLevel - column.level + 1
    } else {
      column.rowSpan = 1
      column.children.forEach((col) => (col.isSubColumn = true))
    }
    rows[column.level - 1].push(column)
  })

  return rows
}

function useUtils<T extends DefaultRow>(props: TableHeaderProps<T>) {
  const parent = inject(TABLE_INJECTION_KEY)
  const columnRows = computed(() => {
    return convertToRows(props.store.states.originColumns.value)
  })
  const isGroup = computed(() => {
    const result = columnRows.value.length > 1
    if (result && parent) {
      parent.state.isGroup.value = true
    }
    return result
  })
  const toggleAllSelection = (event: Event) => {
    event.stopPropagation()
    parent?.store.commit('toggleAllSelection')
  }
  return {
    isGroup,
    toggleAllSelection,
    columnRows,
  }
}

export default useUtils

const COLUMN_WIDTH_STORAGE_PREFIX = 'tableView:'

/**
 * @description 获取当前路由路径，优先读取 vue-router，其次使用浏览器 pathname
 */
const resolveRoutePath = <T extends DefaultRow>(table: Table<T>) => {
  const route = table.proxy?.$route
  if (route && typeof route.path === 'string') return route.path
  if (isClient) {
    return window.location?.pathname ?? ''
  }
  return ''
}

/**
 * @description 计算列的唯一标识，优先使用 column-key/prop 等
 */
const resolveColumnIdentifier = <T extends DefaultRow>(
  column: TableColumnCtx<T>
) => {
  return column.columnKey || column.property || column.rawColumnKey || column.id
}

/**
 * @description 负责持久化列宽并在表格渲染时恢复
 */
export const useColumnWidthPersistence = <T extends DefaultRow>(
  table: Table<T>,
  props: TableProps<T>,
  store: Store<T>
) => {
  const cachedWidths = shallowRef<Record<string, number>>({})

  const isPersistenceEnabled = computed(
    () => !!props.saveColumnWidth && !!props.id && isClient
  )

  const routePath = computed(() => resolveRoutePath(table))

  const resolvedStorageKey = computed(() => {
    if (!isPersistenceEnabled.value) return ''
    const origin = isClient ? (window.location?.origin ?? '') : ''
    return `${COLUMN_WIDTH_STORAGE_PREFIX}${origin}:${routePath.value}#${props.id}`
  })

  /**
   * @description 从 localStorage 读取列宽映射
   */
  const readWidthsFromStorage = (key: string) => {
    if (!key || !isClient) return {}
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed).reduce(
          (acc, [columnKey, width]) => {
            const numericWidth = Number(width)
            if (!Number.isNaN(numericWidth)) {
              acc[columnKey] = numericWidth
            }
            return acc
          },
          {} as Record<string, number>
        )
      }
    } catch {
      return {}
    }
    return {}
  }

  /**
   * @description 将当前列宽映射持久化到 localStorage
   */
  const persistWidthsToStorage = (
    key: string,
    widths: Record<string, number>
  ) => {
    if (!key || !isClient) return
    try {
      window.localStorage.setItem(key, JSON.stringify(widths))
    } catch {
      // 忽略存储空间配额异常
    }
  }

  /**
   * @description 根据缓存的列宽更新现有列配置
   */
  const applyPersistedWidths = () => {
    if (!resolvedStorageKey.value) return
    const leafColumns = store.states.columns.value
    if (!leafColumns.length) return
    const widthMap = cachedWidths.value
    if (!Object.keys(widthMap).length) return
    let mutated = false
    leafColumns.forEach((column) => {
      const identifier = resolveColumnIdentifier(column)
      const savedWidth = identifier ? widthMap[identifier] : undefined
      if (typeof savedWidth === 'number' && !Number.isNaN(savedWidth)) {
        if (column.width !== savedWidth || column.realWidth !== savedWidth) {
          column.width = savedWidth
          column.realWidth = savedWidth
          mutated = true
        }
      }
    })
    if (mutated) {
      store.scheduleLayout(false, true)
    }
  }

  /**
   * @description 在列拖拽结束时更新缓存并写入存储
   */
  const persistColumnWidth = (column: TableColumnCtx<T>, width: number) => {
    if (!isPersistenceEnabled.value || !resolvedStorageKey.value) return
    const identifier = resolveColumnIdentifier(column)
    const numericWidth = Number(width)
    if (!identifier || Number.isNaN(numericWidth)) return
    const next = {
      ...cachedWidths.value,
      [identifier]: numericWidth,
    }
    cachedWidths.value = next
    persistWidthsToStorage(resolvedStorageKey.value, next)
  }

  // 当路由或 table id 变化时重新读取缓存
  watch(
    resolvedStorageKey,
    (key) => {
      if (!key) {
        cachedWidths.value = {}
        table.persistColumnWidth = undefined
        return
      }
      cachedWidths.value = readWidthsFromStorage(key)
      table.persistColumnWidth = persistColumnWidth
      applyPersistedWidths()
    },
    { immediate: true }
  )

  // 列可能被动态重建，监听以便重新应用缓存宽度
  watch(
    () => store.states.columns.value,
    () => {
      if (isPersistenceEnabled.value) {
        applyPersistedWidths()
      }
    }
  )

  // 当配置或前置条件变化时，动态开启/关闭持久化
  watch(isPersistenceEnabled, (enabled) => {
    if (!enabled) {
      table.persistColumnWidth = undefined
    } else if (resolvedStorageKey.value) {
      table.persistColumnWidth = persistColumnWidth
      applyPersistedWidths()
    }
  })

  return () => {
    table.persistColumnWidth = undefined
  }
}
