import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

export interface DataTableOptions<T extends Record<string, any>> {
  searchFields?: (keyof T)[]
  defaultSort?: {
    key: keyof T
    dir: 'asc' | 'desc'
  }
  defaultPageSize?: number
}

export function useDataTable<T extends Record<string, any>>(
  items: Ref<T[]> | ComputedRef<T[]>,
  options: DataTableOptions<T> = {}
) {
  const searchQuery = ref('')
  const sortKey = ref<keyof T | ''>(options.defaultSort?.key ?? '')
  const sortDir = ref<'asc' | 'desc'>(options.defaultSort?.dir ?? 'asc')
  const currentPage = ref(1)
  const pageSize = ref(options.defaultPageSize ?? 10)

  // Filter items based on search query
  const filteredItems = computed(() => {
    const list = items.value
    if (!searchQuery.value.trim() || !options.searchFields?.length) {
      return list
    }
    const q = searchQuery.value.toLowerCase().trim()
    return list.filter((item) => {
      return options.searchFields!.some((field) => {
        const val = item[field]
        if (val == null) return false
        return String(val).toLowerCase().includes(q)
      })
    })
  })

  // Sort filtered items
  const sortedItems = computed(() => {
    const list = [...filteredItems.value]
    const key = sortKey.value
    if (!key) return list

    const dirMultiplier = sortDir.value === 'asc' ? 1 : -1

    return list.sort((a, b) => {
      const valA = a[key]
      const valB = b[key]

      // Handle nulls / undefined
      if (valA == null) return valB == null ? 0 : 1
      if (valB == null) return -1

      // String comparison
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * dirMultiplier
      }

      // Numeric or generic comparison
      if (valA < valB) return -1 * dirMultiplier
      if (valA > valB) return 1 * dirMultiplier
      return 0
    })
  })

  // Paginated items
  const paginatedItems = computed(() => {
    const list = sortedItems.value
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return list.slice(start, end)
  })

  // Total pages calculation
  const totalPages = computed(() => {
    return Math.max(1, Math.ceil(sortedItems.value.length / pageSize.value))
  })

  // Set sorting key & direction
  function setSort(key: keyof T) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'asc'
    }
    currentPage.value = 1 // Reset to first page when sort changes
  }

  // Navigation helpers
  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++
    }
  }

  function prevPage() {
    if (currentPage.value > 1) {
      currentPage.value--
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  // Reset page when search changes
  watch(searchQuery, () => {
    currentPage.value = 1
  })

  return {
    searchQuery,
    sortKey,
    sortDir,
    currentPage,
    pageSize,
    filteredItems,
    sortedItems,
    processedItems: paginatedItems,
    totalPages,
    setSort,
    nextPage,
    prevPage,
    goToPage,
  }
}
