import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import Sortable from 'sortablejs'
import { isClient } from '@element-plus/utils'
import { reorderColumnsByKeys, resolveColumnIdentifier } from './utils-helper'

import type { Ref } from 'vue'
import type { ColumnDragZone, DefaultRow, Table } from '../table/defaults'
import type { Store } from '../store'

interface UseColumnDragOptions<T extends DefaultRow> {
  headerRef: Ref<HTMLElement | undefined>
  store: Store<T>
  table?: Table<T>
  isGroup: Ref<boolean>
}

/**
 * @description 负责在表头上挂载 Sortable，实现列拖拽排序
 */
export const useColumnDrag = <T extends DefaultRow>(
  options: UseColumnDragOptions<T>
) => {
  const sortableRef = shallowRef<Sortable | null>(null)

  let forbiddenState = false
  let lastDraggedEl: HTMLElement | null = null
  const setForbiddenState = (
    forbidden: boolean,
    dragged?: HTMLElement | null
  ) => {
    if (forbiddenState === forbidden && dragged === lastDraggedEl) return
    forbiddenState = forbidden
    if (dragged) {
      dragged.classList.toggle('is-drag-forbidden', forbidden)
      lastDraggedEl = dragged
    }
    if (!dragged && lastDraggedEl) {
      lastDraggedEl.classList.toggle('is-drag-forbidden', forbidden)
    }
    if (!forbidden) {
      document.body.style.cursor = ''
    } else {
      document.body.style.cursor = 'not-allowed'
    }
  }

  const tableDragEnabled = computed(
    () => options.table?.props?.enableColumnDrag !== false
  )

  const destroySortable = () => {
    sortableRef.value?.destroy()
    sortableRef.value = null
    setForbiddenState(false, lastDraggedEl)
    lastDraggedEl = null
  }

  const setupSortable = async () => {
    if (!isClient) return
    if (!tableDragEnabled.value) return
    if (options.isGroup.value) return
    await nextTick()
    const headerEl = options.headerRef.value
    if (!headerEl) return
    const rowEl = headerEl.querySelector('tr')
    if (!rowEl) return
    const cells = Array.from(rowEl.children)
    if (cells.length < 2) return
    destroySortable()
    sortableRef.value = Sortable.create(rowEl as HTMLElement, {
      animation: 150,
      handle: '[data-column-handle="true"]',
      draggable: 'th[data-column-draggable="true"]',
      ghostClass: 'is-dragging',
      chosenClass: 'is-chosen',
      onMove: (evt) => {
        const draggedZone = evt.dragged?.dataset.columnZone
        const relatedZone =
          evt.related?.dataset.columnZone ?? evt.to?.dataset.columnZone
        const allowed =
          !draggedZone || !relatedZone || draggedZone === relatedZone
        setForbiddenState(!allowed, evt.dragged as HTMLElement | undefined)
        return allowed
      },
      onEnd: (event) => {
        setForbiddenState(false, event.item as HTMLElement)
        const items = Array.from(
          (rowEl as HTMLElement).children
        ) as HTMLElement[]
        const zone = (event.item.dataset.columnZone ||
          'center') as ColumnDragZone
        const orderKeys = items
          .filter((item) => item.dataset.columnZone === zone)
          .map((item) => item.dataset.columnId)
          .filter((id): id is string => Boolean(id))
        if (orderKeys.length < 2) return
        const reordered = options.table?.persistColumnOrder
          ? options.table.persistColumnOrder(orderKeys, zone)
          : reorderColumnsByKeys(options.store, orderKeys, zone)
        if (reordered) {
          options.table?.emit?.('header-dragend-order', orderKeys, zone, event)
        }
      },
    })
  }

  const columnsSignature = computed(() => {
    return options.store.states.columns.value
      .map((column) => resolveColumnIdentifier(column))
      .join('|')
  })

  watch(
    [
      () => options.isGroup.value,
      () => options.store.states.isComplex.value,
      tableDragEnabled,
    ],
    () => {
      destroySortable()
      setupSortable()
    },
    { immediate: true }
  )

  watch(columnsSignature, () => {
    destroySortable()
    setupSortable()
  })

  onBeforeUnmount(() => {
    destroySortable()
  })
}
