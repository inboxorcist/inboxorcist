import { useState, useCallback, useMemo, useEffect } from 'react'
import { type RowSelectionState, type ColumnSizingState } from '@tanstack/react-table'
import type { EmailRecord, ExplorerFilters } from '@/lib/api'

interface UseEmailActionsOptions {
  accountId: string
  emails: EmailRecord[]
  page: number
  refetch: () => void
}

interface ActionResult {
  success: boolean
  message: string
}

export function useEmailActions({ accountId, emails, page, refetch }: UseEmailActionsOptions) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [actionResult, setActionResult] = useState<ActionResult | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTrashing, setIsTrashing] = useState(false)

  // Clear selection when page changes
  useEffect(() => {
    setRowSelection({})
  }, [page])

  // Get selected email IDs from row selection
  // Note: rowSelection keys ARE the gmail_ids (set via getRowId in EmailTable)
  const selectedEmailIds = useMemo(() => {
    return Object.keys(rowSelection).filter((key) => rowSelection[key])
  }, [rowSelection])

  // Get selected emails that are NOT already in trash (for trash button)
  const nonTrashedSelectedIds = useMemo(() => {
    return selectedEmailIds.filter((id) => {
      const email = emails.find((e) => e.gmail_id === id)
      return email && email.is_trash !== 1
    })
  }, [selectedEmailIds, emails])

  const isActionLoading = isTrashing || isDeleting

  // Handle trash (no confirmation needed)
  const handleTrash = useCallback(async () => {
    const { trashEmails } = await import('@/lib/api')
    setIsTrashing(true)
    try {
      const result = await trashEmails(accountId, nonTrashedSelectedIds)
      setActionResult({ success: result.success, message: result.message })
      setRowSelection({})
      refetch()
    } catch (err) {
      setActionResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to trash emails',
      })
    } finally {
      setIsTrashing(false)
    }
  }, [accountId, nonTrashedSelectedIds, refetch])

  // Handle permanent delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    const { permanentlyDeleteEmails } = await import('@/lib/api')
    setIsDeleting(true)
    try {
      const result = await permanentlyDeleteEmails(accountId, selectedEmailIds)
      setActionResult({ success: result.success, message: result.message })
      setRowSelection({})
      refetch()
    } catch (err) {
      setActionResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to delete emails',
      })
    } finally {
      setIsDeleting(false)
    }
    setShowDeleteDialog(false)
  }, [accountId, selectedEmailIds, refetch])

  // Clear action result
  const clearActionResult = useCallback(() => {
    setActionResult(null)
  }, [])

  // Clear selection
  const clearSelection = useCallback(() => {
    setRowSelection({})
  }, [])

  return {
    // State
    showDeleteDialog,
    setShowDeleteDialog,
    actionResult,
    rowSelection,
    setRowSelection,
    columnSizing,
    setColumnSizing,
    isDeleting,
    isTrashing,
    isActionLoading,

    // Computed
    selectedEmailIds,
    nonTrashedSelectedIds,

    // Actions
    handleTrash,
    handleDeleteConfirm,
    clearActionResult,
    clearSelection,
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
