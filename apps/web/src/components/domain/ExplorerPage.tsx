import { useEffect, useRef } from 'react'
import { useExplorerEmails } from '@/hooks/useExplorerEmails'
import { useEmailActions, hasActiveFilters } from '@/hooks/useEmailActions'
import { SyncStatusBar } from './SyncStatusBar'
import { SyncProgress } from './SyncProgress'
import {
  EmailFilters,
  EmailTable,
  EmailPagination,
  EmailActionButtons,
  DeleteConfirmDialog,
  SelectAllBanner,
} from './email-browser'
import { useLanguage } from '@/hooks/useLanguage'
import { useAppContext } from '@/routes/__root'

interface ExplorerPageProps {
  accountId: string
  syncStatus: string | null
  syncStartedAt?: string | null
  syncCompletedAt?: string | null
  onSyncComplete?: () => void
  autoSelectAll?: boolean
}

export function ExplorerPage({
  accountId,
  syncStatus,
  syncStartedAt,
  syncCompletedAt,
  onSyncComplete,
  autoSelectAll = false,
}: ExplorerPageProps) {
  const { t } = useLanguage()
  const { syncProgress, syncLoading, resumeSync, isSyncing } = useAppContext()
  const autoSelectTriggered = useRef(false)

  const {
    emails,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    page,
    setPage,
    refetch,
    clearFilters,
    totalSizeBytes,
  } = useExplorerEmails(accountId)

  const {
    showDeleteDialog,
    setShowDeleteDialog,
    rowSelection,
    setRowSelection,
    columnSizing,
    setColumnSizing,
    isTrashing,
    isDeleting,
    isActionLoading,
    selectAllMode,
    allPageSelected,
    effectiveSelectedCount,
    effectiveNonTrashedCount,
    handleTrash,
    handleDeleteConfirm,
    selectAllMatching,
    clearSelectAllMode,
  } = useEmailActions({
    accountId,
    emails,
    page,
    filters,
    totalMatchingCount: pagination?.total ?? 0,
    refetch,
  })

  // Auto-select all when coming from cleanup cards with selectAll=true
  useEffect(() => {
    if (
      autoSelectAll &&
      !autoSelectTriggered.current &&
      !isLoading &&
      (pagination?.total ?? 0) > 0
    ) {
      autoSelectTriggered.current = true
      selectAllMatching()
    }
  }, [autoSelectAll, isLoading, pagination?.total, selectAllMatching])

  const activeFilters = hasActiveFilters(filters)
  const isSyncPending = syncStatus !== 'completed'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('explorer.title')}</h1>
          <p className="text-muted-foreground">{t('explorer.description')}</p>
        </div>
        {syncStatus === 'completed' && (
          <SyncStatusBar
            accountId={accountId}
            syncStartedAt={syncStartedAt ?? null}
            syncCompletedAt={syncCompletedAt ?? null}
            syncStatus={syncStatus}
            onSyncComplete={() => {
              onSyncComplete?.()
              refetch()
            }}
          />
        )}
      </div>

      {/* Sync Progress Banner */}
      {isSyncing && (
        <SyncProgress
          progress={syncProgress}
          isLoading={syncLoading}
          onResume={resumeSync}
          showSkeleton={isSyncing}
        />
      )}

      {/* Filters */}
      <EmailFilters
        filters={filters}
        onFiltersChange={setFilters}
        accountId={accountId}
        syncStatus={syncStatus}
        disabled={isSyncPending}
      />

      {/* Pagination and Action buttons row */}
      {!isSyncPending && (
        <div className="flex items-center justify-between">
          {/* Action buttons on the left */}
          <div>
            <EmailActionButtons
              selectedCount={effectiveSelectedCount}
              nonTrashedCount={effectiveNonTrashedCount}
              isActionLoading={isActionLoading}
              isTrashing={isTrashing}
              isDeleting={isDeleting}
              onTrash={handleTrash}
              onDelete={() => setShowDeleteDialog(true)}
            />
          </div>
          {/* Pagination on the right */}
          <EmailPagination
            pagination={pagination}
            page={page}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Select All Banner */}
      {!isSyncPending && (
        <SelectAllBanner
          selectAllMode={selectAllMode}
          allPageSelected={allPageSelected}
          pageSize={pagination?.limit ?? 50}
          totalMatchingCount={pagination?.total ?? 0}
          totalSizeBytes={totalSizeBytes}
          onSelectAllMatching={selectAllMatching}
          onClearSelectAll={clearSelectAllMode}
        />
      )}

      {/* Table */}
      <EmailTable
        emails={emails}
        isLoading={isLoading}
        error={error}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        columnSizing={columnSizing}
        onColumnSizingChange={setColumnSizing}
        isSyncPending={isSyncPending}
        hasActiveFilters={activeFilters}
        onClearFilters={clearFilters}
      />

      {/* Permanent Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={effectiveSelectedCount}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </div>
  )
}
