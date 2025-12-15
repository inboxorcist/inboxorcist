import { useExplorerEmails } from '@/hooks/useExplorerEmails'
import { useEmailActions, hasActiveFilters } from '@/hooks/useEmailActions'
import { SyncStatusBar } from './SyncStatusBar'
import { SyncProgress } from './SyncProgress'
import {
  EmailFilters,
  EmailTable,
  EmailPagination,
  ActionResultToast,
  EmailActionButtons,
  DeleteConfirmDialog,
} from './email-browser'
import { useLanguage } from '@/hooks/useLanguage'
import { useAppContext } from '@/routes/__root'

interface ExplorerPageProps {
  accountId: string
  syncStatus: string | null
  syncStartedAt?: string | null
  syncCompletedAt?: string | null
  onSyncComplete?: () => void
}

export function ExplorerPage({
  accountId,
  syncStatus,
  syncStartedAt,
  syncCompletedAt,
  onSyncComplete,
}: ExplorerPageProps) {
  const { t } = useLanguage()
  const { syncProgress, syncLoading, resumeSync, isSyncing } = useAppContext()

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
  } = useExplorerEmails(accountId)

  const {
    showDeleteDialog,
    setShowDeleteDialog,
    actionResult,
    rowSelection,
    setRowSelection,
    columnSizing,
    setColumnSizing,
    isTrashing,
    isDeleting,
    isActionLoading,
    selectedEmailIds,
    nonTrashedSelectedIds,
    handleTrash,
    handleDeleteConfirm,
    clearActionResult,
  } = useEmailActions({ accountId, emails, page, refetch })

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

      {/* Action result toast */}
      {actionResult && <ActionResultToast result={actionResult} onDismiss={clearActionResult} />}

      {/* Filters */}
      <EmailFilters
        filters={filters}
        onFiltersChange={setFilters}
        accountId={accountId}
        syncStatus={syncStatus}
      />

      {/* Pagination and Action buttons row */}
      {!isSyncPending && (
        <div className="flex items-center justify-between">
          {/* Action buttons on the left */}
          <div>
            <EmailActionButtons
              selectedCount={selectedEmailIds.length}
              nonTrashedCount={nonTrashedSelectedIds.length}
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
        selectedCount={selectedEmailIds.length}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
