import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import {
  getExplorerEmails,
  trashEmails,
  type EmailRecord,
  type ExplorerFilters,
  type ExplorerPagination,
} from '@/lib/api'
import { filtersToSearchParams, searchParamsToFilters } from '@/lib/filter-url'

interface UseExplorerEmailsOptions {
  pageSize?: number
  mode?: 'browse' | 'cleanup'
  initialFilters?: ExplorerFilters
  /** If true, sync filters with URL query params (default: true) */
  syncWithUrl?: boolean
}

interface UseExplorerEmailsResult {
  emails: EmailRecord[]
  pagination: ExplorerPagination | null
  isLoading: boolean
  error: string | null
  filters: ExplorerFilters
  setFilters: (filters: ExplorerFilters) => void
  page: number
  setPage: (page: number) => void
  refetch: () => void
  // Selection
  selectedIds: Set<string>
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  isAllSelected: boolean
  // Trash action
  trashSelected: () => Promise<{ success: boolean; message: string }>
  isTrashLoading: boolean
  // Storage info
  totalSizeBytes: number
  // Preset support
  applyPreset: (presetFilters: ExplorerFilters) => void
  clearFilters: () => void
}

export function useExplorerEmails(
  accountId: string | null,
  options: UseExplorerEmailsOptions = {}
): UseExplorerEmailsResult {
  const { mode = 'browse', initialFilters, syncWithUrl = true } = options
  const pageSize = options.pageSize ?? (mode === 'cleanup' ? 1000 : 50)

  const navigate = useNavigate()
  const location = useLocation()

  // Get search params from location
  const getSearchParams = useCallback(() => {
    return new URLSearchParams(location.search)
  }, [location.search])

  // Initialize filters from URL if syncing, otherwise use initialFilters or default
  const getInitialFilters = useCallback((): ExplorerFilters => {
    const searchParams = getSearchParams()
    if (syncWithUrl && searchParams.toString()) {
      return searchParamsToFilters(searchParams)
    }
    return initialFilters ?? { isTrash: false, isSpam: false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: only run once on mount, deps captured at mount time
  }, [])

  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [pagination, setPagination] = useState<ExplorerPagination | null>(null)
  const [totalSizeBytes, setTotalSizeBytes] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<ExplorerFilters>(getInitialFilters)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isTrashLoading, setIsTrashLoading] = useState(false)

  // Update URL when filters change (if syncing enabled)
  const setFilters = useCallback(
    (newFilters: ExplorerFilters) => {
      setFiltersState(newFilters)
      if (syncWithUrl) {
        const params = filtersToSearchParams(newFilters)
        const searchString = params.toString()
        navigate({
          to: '.',
          search: searchString ? Object.fromEntries(params) : {},
          replace: true,
        })
      }
    },
    [syncWithUrl, navigate]
  )

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [filters])

  // Reset selection when page changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [page])

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    if (!accountId) {
      setEmails([])
      setPagination(null)
      setTotalSizeBytes(0)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await getExplorerEmails(accountId, filters, page, pageSize, mode)
      setEmails(response.emails)
      setPagination(response.pagination)
      setTotalSizeBytes(response.totalSizeBytes ?? 0)
    } catch (err) {
      console.error('[useExplorerEmails] Error fetching emails:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch emails')
      setEmails([])
      setPagination(null)
      setTotalSizeBytes(0)
    } finally {
      setIsLoading(false)
    }
  }, [accountId, filters, page, pageSize, mode])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(emails.map((e) => e.message_id)))
  }, [emails])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isAllSelected = useMemo(() => {
    return emails.length > 0 && selectedIds.size === emails.length
  }, [emails.length, selectedIds.size])

  // Apply a filter preset (e.g., from cleanup cards)
  const applyPreset = useCallback(
    (presetFilters: ExplorerFilters) => {
      setFilters(presetFilters)
    },
    [setFilters]
  )

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({ isTrash: false, isSpam: false })
  }, [setFilters])

  // Trash selected emails
  const trashSelected = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!accountId || selectedIds.size === 0) {
      return { success: false, message: 'No emails selected' }
    }

    setIsTrashLoading(true)

    try {
      const result = await trashEmails(accountId, Array.from(selectedIds))

      // Refetch to update the list
      await fetchEmails()

      // Clear selection after successful trash
      setSelectedIds(new Set())

      return {
        success: result.success,
        message: result.message,
      }
    } catch (err) {
      console.error('[useExplorerEmails] Error trashing emails:', err)
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to trash emails',
      }
    } finally {
      setIsTrashLoading(false)
    }
  }, [accountId, selectedIds, fetchEmails])

  return {
    emails,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    page,
    setPage,
    refetch: fetchEmails,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isAllSelected,
    trashSelected,
    isTrashLoading,
    totalSizeBytes,
    applyPreset,
    clearFilters,
  }
}
