import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import Sortable from 'sortablejs'
import { isClient } from '@element-plus/utils'
import { reorderColumnsByKeys, resolveColumnIdentifier } from './utils-helper'

import type { Ref } from 'vue'
import type { DefaultRow, Table } from '../table/defaults'
import type { Store } from '../store'

interface UseColumnDragOptions<T extends DefaultRow> {
  headerRef: Ref<HTMLElement | undefined>
  store: Store<T>
  table?: Table<T>
  isGroup: Ref<boolean>
}

export const useColumnDrag = <T extends DefaultRow>(
  options: UseColumnDragOptions<T>
) => {
  const sortableRef = shallowRef<Sortable | null>(null)

  const destroySortable = () => {
    sortableRef.value?.destroy()
    sortableRef.value = null
  }

  const setupSortable = async () => {
    if (!isClient) return
    if (options.isGroup.value) return
    if (options.store.states.isComplex.value) return
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
      handle: '.cell',
      draggable: 'th',
      ghostClass: 'is-dragging',
      chosenClass: 'is-chosen',
      onEnd: () => {
        const items = Array.from(
          (rowEl as HTMLElement).children
        ) as HTMLElement[]
        const orderKeys = items
          .map((item) => item.dataset.columnId)
          .filter((id): id is string => Boolean(id))
        if (orderKeys.length < 2) return
        if (options.table?.persistColumnOrder) {
          options.table.persistColumnOrder(orderKeys)
        } else {
          reorderColumnsByKeys(options.store, orderKeys)
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
    [() => options.isGroup.value, () => options.store.states.isComplex.value],
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
