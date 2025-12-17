import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type RowSelectionState, type ColumnSizingState } from '@tanstack/react-table'
import type { EmailRecord, ExplorerFilters } from '@/lib/api'
import { toast } from 'sonner'

interface UseEmailActionsOptions {
  accountId: string
  emails: EmailRecord[]
  page: number
  filters?: ExplorerFilters
  totalMatchingCount?: number
  refetch: () => void
}

export function useEmailActions({
  accountId,
  emails,
  page,
  filters,
  totalMatchingCount = 0,
  refetch,
}: UseEmailActionsOptions) {
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTrashing, setIsTrashing] = useState(false)
  const [selectAllMode, setSelectAllMode] = useState<'page' | 'all'>('page')

  // Clear selection when page or filters change
  useEffect(() => {
    setRowSelection({})
    setSelectAllMode('page')
  }, [page, filters])

  // Get selected email IDs from row selection
  // Note: rowSelection keys ARE the gmail_ids (set via getRowId in EmailTable)
  const selectedEmailIds = useMemo(() => {
    return Object.keys(rowSelection).filter((key) => rowSelection[key])
  }, [rowSelection])

  // Check if all emails on current page are selected
  const allPageSelected = useMemo(() => {
    return emails.length > 0 && emails.every((email) => rowSelection[email.gmail_id])
  }, [emails, rowSelection])

  // Get selected emails that are NOT already in trash (for trash button)
  const nonTrashedSelectedIds = useMemo(() => {
    return selectedEmailIds.filter((id) => {
      const email = emails.find((e) => e.gmail_id === id)
      return email && email.is_trash !== 1
    })
  }, [selectedEmailIds, emails])

  // Effective count for display (page selection or all matching)
  const effectiveSelectedCount =
    selectAllMode === 'all' ? totalMatchingCount : selectedEmailIds.length
  const effectiveNonTrashedCount =
    selectAllMode === 'all' ? totalMatchingCount : nonTrashedSelectedIds.length

  const isActionLoading = isTrashing || isDeleting

  // Select all matching emails (not just current page)
  const selectAllMatching = useCallback(() => {
    // Also select all visible rows for visual feedback
    const allVisibleSelected: RowSelectionState = {}
    emails.forEach((email) => {
      allVisibleSelected[email.gmail_id] = true
    })
    setRowSelection(allVisibleSelected)
    setSelectAllMode('all')
  }, [emails])

  // Clear select all mode
  const clearSelectAllMode = useCallback(() => {
    setSelectAllMode('page')
  }, [])

  // Handle trash (no confirmation needed)
  const handleTrash = useCallback(async () => {
    const { trashEmails } = await import('@/lib/api')
    setIsTrashing(true)
    try {
      // Use filters when in 'all' mode, otherwise use selected IDs
      const result =
        selectAllMode === 'all' && filters
          ? await trashEmails(accountId, filters)
          : await trashEmails(accountId, nonTrashedSelectedIds)

      if (result.success) {
        toast.success(result.message)
        // Invalidate stats since email counts changed
        queryClient.invalidateQueries({ queryKey: ['stats', accountId] })
      } else {
        toast.error(result.message)
      }
      setRowSelection({})
      setSelectAllMode('page')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to trash emails')
    } finally {
      setIsTrashing(false)
    }
  }, [accountId, nonTrashedSelectedIds, filters, selectAllMode, refetch, queryClient])

  // Handle permanent delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    const { permanentlyDeleteEmails } = await import('@/lib/api')
    setIsDeleting(true)
    try {
      // Use filters when in 'all' mode, otherwise use selected IDs
      const result =
        selectAllMode === 'all' && filters
          ? await permanentlyDeleteEmails(accountId, filters)
          : await permanentlyDeleteEmails(accountId, selectedEmailIds)

      if (result.success) {
        toast.success(result.message)
        // Invalidate stats since email counts changed
        queryClient.invalidateQueries({ queryKey: ['stats', accountId] })
      } else {
        toast.error(result.message)
      }
      setRowSelection({})
      setSelectAllMode('page')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete emails')
    } finally {
      setIsDeleting(false)
    }
    setShowDeleteDialog(false)
  }, [accountId, selectedEmailIds, filters, selectAllMode, refetch, queryClient])

  // Clear selection
  const clearSelection = useCallback(() => {
    setRowSelection({})
    setSelectAllMode('page')
  }, [])

  return {
    // State
    showDeleteDialog,
    setShowDeleteDialog,
    rowSelection,
    setRowSelection,
    columnSizing,
    setColumnSizing,
    isDeleting,
    isTrashing,
    isActionLoading,
    selectAllMode,

    // Computed
    selectedEmailIds,
    nonTrashedSelectedIds,
    allPageSelected,
    effectiveSelectedCount,
    effectiveNonTrashedCount,
    totalMatchingCount,

    // Actions
    handleTrash,
    handleDeleteConfirm,
    clearSelection,
    selectAllMatching,
    clearSelectAllMode,
  }
}

/**
 * Check if any filters are active (beyond the default Inbox state)
 *
 * Note: isTrash: false and isSpam: false is the default "Inbox" state,
 * so we don't count those as active filters. Only count them if they're
 * explicitly set to true (showing trash/spam).
 */
export function hasActiveFilters(filters: ExplorerFilters): boolean {
  return (
    !!filters.sender ||
    !!filters.senderDomain ||
    !!filters.category ||
    !!filters.search ||
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined ||
    filters.sizeMin !== undefined ||
    filters.sizeMax !== undefined ||
    filters.isUnread !== undefined ||
    filters.isStarred !== undefined ||
    filters.hasAttachments !== undefined ||
    filters.isTrash === true || // Only active if explicitly showing trash
    filters.isSpam === true || // Only active if explicitly showing spam
    filters.isImportant !== undefined
  )
}
