import { computed, inject, shallowRef, watch } from 'vue'
import { ElMessageBox } from '@element-plus/components/message-box'
import { openDB } from 'idb'
import { isClient } from '@element-plus/utils'
import { TABLE_INJECTION_KEY } from '../tokens'

import type {
  ColumnDragZone,
  DefaultRow,
  Table,
  TableProps,
} from '../table/defaults'
import type { TableColumnCtx } from '../table-column/defaults'
import type { TableHeaderProps } from '.'
import type { Store } from '../store'

/**
 * @description 递归展开所有列，用于构造扁平列表
 */
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

/**
 * @description 将列信息转换为二维数组，方便表头逐行渲染
 */
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

/**
 * @description 提供表头需要的辅助逻辑（分组/全选等）
 */
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

const COLUMN_WIDTH_STORAGE_PREFIX = 'bsui:el-table:'
const STORAGE_VERSION = 1
const DB_NAME = 'bsui'
const DB_VERSION = 1
const DB_STORE_NAME = 'el-table'

interface ColumnPersistencePayload {
  v: number
  updatedAt: number
  tableId: string
  colWidth: Record<string, number>
  colOrder?: string[]
  colOrderByZone?: Partial<Record<ColumnDragZone, string[]>>
  colVisible?: Record<string, boolean>
  meta?: Record<string, unknown>
}

/**
 * @description 构造一份空的列配置持久化数据
 */
const createEmptyPayload = (tableId: string): ColumnPersistencePayload => ({
  v: STORAGE_VERSION,
  updatedAt: Date.now(),
  tableId,
  colWidth: {},
  meta: {
    creator: 'el-table',
  },
})

/**
 * @description 过滤无效宽度值，返回列宽映射
 */
const normalizeWidthMap = (value: Record<string, any> | undefined) => {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value).reduce<Record<string, number>>(
    (acc, [key, width]) => {
      const numericWidth = Number(width)
      if (!Number.isNaN(numericWidth)) {
        acc[key] = numericWidth
      }
      return acc
    },
    {}
  )
}

/**
 * @description 过滤无效的列显隐数据
 */
const normalizeVisibilityMap = (value: Record<string, any> | undefined) => {
  if (!value || typeof value !== 'object') return undefined
  const normalized = Object.entries(value).reduce<Record<string, boolean>>(
    (acc, [key, visible]) => {
      if (typeof visible === 'boolean') {
        acc[key] = visible
      }
      return acc
    },
    {}
  )
  return Object.keys(normalized).length ? normalized : undefined
}

/**
 * @description 复制出 meta 信息，确保类型稳定
 */
const normalizeMetaInfo = (value: unknown) => {
  if (!value || typeof value !== 'object') return undefined
  return { ...(value as Record<string, unknown>) }
}

/**
 * @description 将任意对象转换为规范的列配置 payload
 */
const normalizePayload = (
  value: Record<string, any>,
  fallbackId: string
): ColumnPersistencePayload => {
  const colWidth = normalizeWidthMap(value.colWidth)
  const colOrder = Array.isArray(value.colOrder)
    ? value.colOrder.filter((item): item is string => typeof item === 'string')
    : undefined
  const colOrderByZone =
    value.colOrderByZone && typeof value.colOrderByZone === 'object'
      ? (['left', 'center', 'right'] as ColumnDragZone[]).reduce<
          Partial<Record<ColumnDragZone, string[]>>
        >((acc, zone) => {
          const list = value.colOrderByZone[zone]
          if (Array.isArray(list)) {
            const filtered = list.filter(
              (item: unknown): item is string => typeof item === 'string'
            )
            if (filtered.length) {
              acc[zone] = filtered
            }
          }
          return acc
        }, {})
      : undefined
  const colVisible = normalizeVisibilityMap(value.colVisible)
  const meta = normalizeMetaInfo(value.meta)
  return {
    v: typeof value.v === 'number' ? value.v : STORAGE_VERSION,
    updatedAt:
      typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
    tableId:
      typeof value.tableId === 'string' && value.tableId
        ? value.tableId
        : fallbackId,
    colWidth,
    colOrder,
    colOrderByZone,
    colVisible,
    meta,
  }
}

const clonePersistencePayload = (
  payload: ColumnPersistencePayload
): ColumnPersistencePayload => ({
  ...payload,
  colWidth: { ...payload.colWidth },
  colOrder: payload.colOrder ? [...payload.colOrder] : undefined,
  colOrderByZone: payload.colOrderByZone
    ? (['left', 'center', 'right'] as ColumnDragZone[]).reduce<
        Partial<Record<ColumnDragZone, string[]>>
      >((acc, zone) => {
        const list = payload.colOrderByZone?.[zone]
        if (list?.length) {
          acc[zone] = [...list]
        }
        return acc
      }, {})
    : undefined,
  colVisible: payload.colVisible ? { ...payload.colVisible } : undefined,
  meta: payload.meta ? { ...payload.meta } : undefined,
})

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

const normalizeRoutePath = (path: string) => {
  if (!path) return '/'
  return path === '/' ? '/' : path.replace(/\/+$/, '')
}

/**
 * @description 计算列的唯一标识，优先使用 column-key/prop 等
 */
export const resolveColumnIdentifier = <T extends DefaultRow>(
  column: TableColumnCtx<T>
) => {
  return column.columnKey || column.property || column.rawColumnKey || column.id
}

/**
 * @description 根据列的 fixed 属性判定其所在分区
 */
export const resolveColumnZone = <T extends DefaultRow>(
  column: TableColumnCtx<T>
): ColumnDragZone => {
  if (column.fixed === 'right') return 'right'
  if (column.fixed === true || column.fixed === 'left') return 'left'
  return 'center'
}

/**
 * @description 根据给定 key 顺序重新排序列集合
 */
export const reorderColumnsByKeys = <T extends DefaultRow>(
  store: Store<T>,
  orderKeys: string[],
  zone?: ColumnDragZone
) => {
  if (!orderKeys?.length) return false
  const columns = store.states._columns.value
  if (!columns?.length) return false
  const filterByZone = (column: TableColumnCtx<T>) =>
    zone ? resolveColumnZone(column) === zone : true
  const targetColumns = columns.filter(filterByZone)
  if (!targetColumns.length) return false
  const orderMap = new Map(orderKeys.map((key, index) => [key, index]))
  const originalIndexMap = new Map(
    targetColumns.map((column, index) => [column, index])
  )
  const sortedTarget = [...targetColumns]
  sortedTarget.sort((a, b) => {
    const idA = resolveColumnIdentifier(a)
    const idB = resolveColumnIdentifier(b)
    const orderA = orderMap.has(idA)
      ? orderMap.get(idA)!
      : Number.POSITIVE_INFINITY
    const orderB = orderMap.has(idB)
      ? orderMap.get(idB)!
      : Number.POSITIVE_INFINITY
    if (orderA === orderB) {
      return (
        (originalIndexMap.get(a) ?? Number.POSITIVE_INFINITY) -
        (originalIndexMap.get(b) ?? Number.POSITIVE_INFINITY)
      )
    }
    return orderA - orderB
  })
  const newColumns = [...columns]
  if (zone) {
    let insertIndex = 0
    columns.forEach((column, index) => {
      if (filterByZone(column)) {
        newColumns[index] = sortedTarget[insertIndex++]
      }
    })
  } else {
    targetColumns.forEach((column, index) => {
      const originalIndex = columns.indexOf(column)
      newColumns[originalIndex] = sortedTarget[index]
    })
  }
  const isSame =
    newColumns.length === columns.length &&
    newColumns.every((column, index) => column === columns[index])
  if (isSame) return false
  store.states._columns.value = newColumns
  store.updateColumns()
  store.scheduleLayout?.(false, true)
  return true
}

/**
 * @description 负责持久化列宽并在表格渲染时恢复
 */
export const useColumnPersistence = <T extends DefaultRow>(
  table: Table<T>,
  props: TableProps<T>,
  store: Store<T>
) => {
  let dbPromise: ReturnType<typeof openDB> | null = null
  const cachedPayload = shallowRef<ColumnPersistencePayload | null>(null)
  const cachedWidths = shallowRef<Record<string, number>>({})
  const cachedVisibility = shallowRef<Record<string, boolean>>({})

  const columnStoreConfig = computed(() => props.columnStore)

  const shouldPersistWidth = computed(() => {
    const store = columnStoreConfig.value
    if (store === false) return false
    if (store === true || store === undefined) return true
    return Array.isArray(store) ? store.includes('width') : true
  })

  const shouldPersistOrder = computed(() => {
    const store = columnStoreConfig.value
    if (store === false) return false
    if (store === true || store === undefined) return true
    return Array.isArray(store) ? store.includes('order') : true
  })

  const shouldPersistVisibility = computed(() => {
    const store = columnStoreConfig.value
    if (store === false) return false
    if (store === true || store === undefined) return true
    return Array.isArray(store) ? store.includes('visible') : true
  })

  const isPersistenceEnabled = computed(
    () =>
      !!props.id &&
      isClient &&
      (shouldPersistWidth.value ||
        shouldPersistOrder.value ||
        shouldPersistVisibility.value)
  )

  const routePath = computed(() => normalizeRoutePath(resolveRoutePath(table)))

  const resolvedStorageKey = computed(() => {
    if (!isPersistenceEnabled.value) return ''
    let origin = isClient ? (window.location?.origin ?? '') : ''
    origin = origin.replaceAll(':', '%3a')
    const _url = `${origin}${routePath.value}`.toLowerCase()
    return `${COLUMN_WIDTH_STORAGE_PREFIX}${_url}#${props.id}`
  })

  const getDb = async () => {
    if (!isClient) return null
    if (!dbPromise) {
      dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
            db.createObjectStore(DB_STORE_NAME)
          }
        },
      })
    }
    return dbPromise
  }

  /**
   * @description 读取存储中的完整列配置
   */
  const readPayloadFromStorage = async (key: string, tableId: string) => {
    if (!key || !isClient) return createEmptyPayload(tableId)
    try {
      const db = await getDb()
      const raw = db ? await db.get(DB_STORE_NAME, key) : null
      const fallbackRaw = !raw ? window.localStorage.getItem(key) : null
      const parsed = raw ?? (fallbackRaw ? JSON.parse(fallbackRaw) : null)
      if (parsed && typeof parsed === 'object') {
        return normalizePayload(parsed, tableId)
      }
      return createEmptyPayload(tableId)
    } catch {
      return createEmptyPayload(tableId)
    }
  }

  /**
   * @description 将完整列配置写入存储
   */
  const persistPayloadToStorage = async (
    key: string,
    payload: ColumnPersistencePayload
  ) => {
    if (!key || !isClient) return
    try {
      const db = await getDb()
      if (db) {
        await db.put(DB_STORE_NAME, payload, key)
        return
      }
    } catch {
      // 忽略存储异常，尝试回退 localStorage
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(payload))
    } catch {
      // 忽略存储空间配额异常
    }
  }

  /**
   * @description 触发外部存储事件，便于使用者将持久化数据写入自定义介质
   */
  const emitPersistenceSave = (
    key: string,
    payload: ColumnPersistencePayload
  ) => {
    if (!table?.emit || !key) return false
    let handled = false
    const preventDefault = () => {
      handled = true
    }
    table.emit(
      'store-save',
      key,
      clonePersistencePayload(payload),
      preventDefault
    )
    return handled
  }

  /**
   * @description 触发外部加载事件，允许使用者提供自定义持久化数据
   */
  const emitPersistenceLoad = async (key: string, tableId: string) => {
    if (!table?.emit || !key) return null
    let resolved:
      | ColumnPersistencePayload
      | Record<string, any>
      | null
      | undefined
      | Promise<
          ColumnPersistencePayload | Record<string, any> | null | undefined
        >
    const resolver = (
      payload:
        | ColumnPersistencePayload
        | Record<string, any>
        | null
        | undefined
        | Promise<
            ColumnPersistencePayload | Record<string, any> | null | undefined
          >
    ) => {
      resolved = payload
    }
    try {
      table.emit('store-load', key, tableId, resolver)
      if (resolved === undefined) return null
      const normalized = await resolved
      if (normalized && typeof normalized === 'object') {
        return normalizePayload(normalized as Record<string, any>, tableId)
      }
    } catch {
      // 外部事件抛错不应中断默认逻辑
    }
    return null
  }

  const syncPayloadToStorage = (payload: ColumnPersistencePayload) => {
    if (!isPersistenceEnabled.value || !isClient || !resolvedStorageKey.value) {
      return
    }
    const handled = emitPersistenceSave(resolvedStorageKey.value, payload)
    if (handled) return
    persistPayloadToStorage(resolvedStorageKey.value, payload)
  }

  const resolvePersistedPayload = async (key: string, tableId: string) => {
    const fromEvent = await emitPersistenceLoad(key, tableId)
    if (fromEvent) return fromEvent
    return readPayloadFromStorage(key, tableId)
  }

  /**
   * @description 确保已经创建好可复用的 payload
   */
  const ensurePayload = () => {
    if (!props.id) return null
    if (cachedPayload.value) return cachedPayload.value
    const payload = createEmptyPayload(props.id as string)
    cachedPayload.value = payload
    return payload
  }

  /**
   * @description 恢复列顺序，优先使用传入 key，否则使用缓存
   */
  const applyPersistedOrder = () => {
    if (!shouldPersistOrder.value) return
    const payload = cachedPayload.value
    if (payload?.colOrderByZone) {
      ;(['left', 'center', 'right'] as ColumnDragZone[]).forEach((zone) => {
        const keys = payload.colOrderByZone?.[zone]
        if (keys?.length) {
          reorderColumnsByKeys(store, keys, zone)
        }
      })
      return
    }
    const fallbackOrder = payload?.colOrder
    if (fallbackOrder?.length) {
      reorderColumnsByKeys(store, fallbackOrder)
    }
  }

  /**
   * @description 根据缓存的列宽更新现有列配置
   */
  const applyPersistedWidths = () => {
    const leafColumns = store.states.columns.value
    if (!leafColumns.length) return
    if (!shouldPersistWidth.value) return
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
   * @description 应用缓存的列显隐配置（仅标记，不直接改动渲染，可供外部读取使用）
   */
  const applyPersistedVisibility = () => {
    if (!shouldPersistVisibility.value) return
    const payload = cachedPayload.value
    if (!payload?.colVisible) return
    cachedVisibility.value = { ...payload.colVisible }
  }

  /**
   * @description 恢复列的顺序及宽度
   */
  const applyPersistedState = () => {
    applyPersistedOrder()
    applyPersistedWidths()
    applyPersistedVisibility()
  }

  /**
   * @description 在列拖拽结束时更新缓存并写入存储
   */
  const persistColumnWidth = (column: TableColumnCtx<T>, width: number) => {
    if (!shouldPersistWidth.value) return
    if (!isPersistenceEnabled.value || !resolvedStorageKey.value) return
    const payload = ensurePayload()
    if (!payload) return
    const identifier = resolveColumnIdentifier(column)
    const numericWidth = Number(width)
    if (!identifier || Number.isNaN(numericWidth)) return
    const previousWidth = payload.colWidth[identifier]
    if (previousWidth === numericWidth) return
    payload.colWidth = {
      ...payload.colWidth,
      [identifier]: numericWidth,
    }
    payload.updatedAt = Date.now()
    payload.v = STORAGE_VERSION
    payload.tableId = props.id as string
    if (!payload.meta) {
      payload.meta = { creator: 'el-table' }
    }
    cachedPayload.value = payload
    cachedWidths.value = { ...payload.colWidth }
    syncPayloadToStorage(payload)
  }

  /**
   * @description 记录用户自定义列顺序并同步到存储
   */
  const persistColumnOrder = (
    orderedKeys: string[],
    zone: ColumnDragZone = 'center'
  ) => {
    if (!orderedKeys.length) {
      return false
    }
    const reordered = reorderColumnsByKeys(store, orderedKeys, zone)
    if (!reordered) return false
    if (
      !shouldPersistOrder.value ||
      !isPersistenceEnabled.value ||
      !resolvedStorageKey.value
    ) {
      return true
    }
    const payload = ensurePayload()
    if (!payload) return true
    payload.colOrderByZone = payload.colOrderByZone || {}
    payload.colOrderByZone[zone] = [...orderedKeys]
    if (zone === 'center' && !payload.colOrder?.length) {
      payload.colOrder = [...orderedKeys]
    }
    payload.updatedAt = Date.now()
    payload.v = STORAGE_VERSION
    payload.tableId = props.id as string
    if (!payload.meta) {
      payload.meta = { creator: 'el-table' }
    }
    cachedPayload.value = payload
    syncPayloadToStorage(payload)
    return true
  }

  /**
   * @description 更新列显隐状态并写入存储
   */
  const persistColumnVisibility = (identifier: string, visible: boolean) => {
    if (!identifier) return
    if (!shouldPersistVisibility.value) return
    if (!isPersistenceEnabled.value || !resolvedStorageKey.value) return
    const payload = ensurePayload()
    if (!payload) return
    const current = payload.colVisible || {}
    if (current[identifier] === visible) return
    payload.colVisible = {
      ...current,
      [identifier]: visible,
    }
    payload.updatedAt = Date.now()
    payload.v = STORAGE_VERSION
    payload.tableId = props.id as string
    if (!payload.meta) {
      payload.meta = { creator: 'el-table' }
    }
    cachedPayload.value = payload
    cachedVisibility.value = { ...payload.colVisible }
    syncPayloadToStorage(payload)
  }

  /**
   * @description 获取当前缓存的列显隐配置
   */
  const getPersistedColumnVisibility = () => {
    if (!shouldPersistVisibility.value) return {}
    return { ...cachedVisibility.value }
  }

  table.persistColumnWidth = persistColumnWidth
  table.persistColumnOrder = persistColumnOrder
  table.persistColumnVisibility = persistColumnVisibility
  table.getPersistedColumnVisibility = getPersistedColumnVisibility
  table.clearColumnPersistence = async () => {
    if (!isClient) return
    const key = resolvedStorageKey.value
    cachedPayload.value = null
    cachedWidths.value = {}
    cachedVisibility.value = {}
    if (key) {
      try {
        const db = await getDb()
        if (db) {
          await db.delete(DB_STORE_NAME, key)
        }
      } catch {
        // 忽略移除失败
      }
      try {
        window.localStorage.removeItem(key)
      } catch {
        // 忽略移除失败
      }
    }
    try {
      await ElMessageBox.confirm(
        '重置个性化数据后，需要重新刷新页面方能生效，是否立即刷新页面？',
        '提示',
        {
          type: 'warning',
          confirmButtonText: '刷新',
          cancelButtonText: '取消',
        }
      )
      window.location.reload()
    } catch {
      // 用户取消
    }
  }

  // 当路由或 table id 变化时重新读取缓存
  let loadTaskId = 0
  watch(
    resolvedStorageKey,
    async (key) => {
      const taskId = ++loadTaskId
      if (!key) {
        cachedPayload.value = null
        cachedWidths.value = {}
        cachedVisibility.value = {}
        return
      }
      const payload =
        (await resolvePersistedPayload(key, props.id as string)) ||
        createEmptyPayload(props.id as string)
      if (taskId !== loadTaskId) return
      cachedPayload.value = payload
      cachedWidths.value = { ...payload.colWidth }
      cachedVisibility.value = { ...(payload.colVisible || {}) }
      applyPersistedState()
    },
    { immediate: true }
  )

  // 列可能被动态重建，监听以便重新应用缓存宽度
  watch(
    () => store.states.columns.value,
    () => {
      if (isPersistenceEnabled.value) {
        applyPersistedState()
      }
    }
  )

  // 当配置或前置条件变化时，动态开启/关闭持久化
  watch(isPersistenceEnabled, (enabled) => {
    if (enabled && resolvedStorageKey.value) {
      applyPersistedState()
    }
  })

  const dispose = () => {
    table.persistColumnWidth = undefined
    table.persistColumnOrder = undefined
    table.persistColumnVisibility = undefined
    table.getPersistedColumnVisibility = undefined
    table.clearColumnPersistence = undefined
  }

  return {
    dispose,
    persistColumnVisibility,
    getPersistedColumnVisibility,
    clearColumnPersistence: table.clearColumnPersistence,
  }
}
