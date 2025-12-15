import { useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import type { QuickStats, SyncProgress as SyncProgressType } from "@/lib/api";
import { QuickExorcismSection, type CleanupCategory } from "./QuickExorcismSection";
import { SyncStatusBar } from "./SyncStatusBar";
import { SyncProgress } from "./SyncProgress";
import {
  EmailFilters,
  EmailTable,
  EmailPagination,
  StorageInfo,
  ActionResultToast,
  EmailActionButtons,
  DeleteConfirmDialog,
  CLEANUP_PRESETS,
} from "./email-browser";
import { useExplorerEmails } from "@/hooks/useExplorerEmails";
import { useEmailActions, hasActiveFilters } from "@/hooks/useEmailActions";
import { useAppContext } from "@/routes/__root";

interface CleanupPageProps {
  accountId: string;
  stats: QuickStats | null;
  syncProgress: SyncProgressType | null;
  syncStatus: string | null;
  syncStartedAt?: string | null;
  syncCompletedAt?: string | null;
  isSyncing?: boolean;
  onSyncComplete?: () => void;
}

export function CleanupPage({
  accountId,
  stats,
  syncProgress,
  syncStatus,
  syncStartedAt,
  syncCompletedAt,
  isSyncing = false,
  onSyncComplete,
}: CleanupPageProps) {
  const { syncLoading, resumeSync, isSyncing: contextIsSyncing } = useAppContext();

  // Track active preset for highlighting (for future UI indication)
  const [, setActivePreset] = useState<CleanupCategory | null>(null);

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
    totalSizeBytes,
    clearFilters,
  } = useExplorerEmails(accountId, { mode: "cleanup" });

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
    clearSelection,
  } = useEmailActions({ accountId, emails, page, refetch });

  // Handle cleanup card click - apply filter preset
  const handleCardClick = useCallback(
    (categories: CleanupCategory[]) => {
      if (categories.length === 0) return;

      // For single category, use the preset directly
      // For multiple categories (like promo purge), combine the filters
      // TODO: Support OR queries for multiple categories
      const category = categories[0];
      setActivePreset(category);
      setFilters(CLEANUP_PRESETS[category]);
      clearSelection();
    },
    [setFilters, clearSelection]
  );

  // Handle manual filter changes
  const handleFiltersChange = useCallback(
    (newFilters: typeof filters) => {
      setFilters(newFilters);
      setActivePreset(null);
      clearSelection();
    },
    [setFilters, clearSelection]
  );

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    clearFilters();
    setActivePreset(null);
    clearSelection();
  }, [clearFilters, clearSelection]);

  const activeFilters = hasActiveFilters(filters);
  const isSyncPending = syncStatus !== "completed";

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Stats not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cleanup</h1>
          <p className="text-muted-foreground">Select emails to delete and free up space</p>
        </div>
        {syncStatus === "completed" && (
          <SyncStatusBar
            accountId={accountId}
            syncStartedAt={syncStartedAt ?? null}
            syncCompletedAt={syncCompletedAt ?? null}
            syncStatus={syncStatus}
            onSyncComplete={() => {
              onSyncComplete?.();
              refetch();
            }}
          />
        )}
      </div>

      {/* Sync Progress Banner */}
      {(contextIsSyncing || isSyncing) && (
        <SyncProgress
          progress={syncProgress}
          isLoading={syncLoading}
          onResume={resumeSync}
          showSkeleton={contextIsSyncing || isSyncing}
        />
      )}

      {/* Quick Cleanup Cards */}
      <QuickExorcismSection
        stats={stats}
        syncProgress={syncProgress}
        isSyncing={isSyncing}
        selectable={false}
        onExorcise={handleCardClick}
      />

      {/* Storage Info - when filters are active */}
      {activeFilters && totalSizeBytes > 0 && pagination && (
        <StorageInfo totalSizeBytes={totalSizeBytes} totalCount={pagination.total} />
      )}

      {/* Action result toast */}
      {actionResult && (
        <ActionResultToast result={actionResult} onDismiss={clearActionResult} />
      )}

      {/* Filters */}
      <EmailFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        accountId={accountId}
        syncStatus={syncStatus}
      />

      {/* Pagination and Action buttons row */}
      {!isSyncPending && activeFilters && (
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

      {/* Table - Only show when filters are active */}
      {activeFilters && (
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
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Empty state when no filters */}
      {!activeFilters && !isSyncPending && (
        <div className="p-12 text-center border rounded-lg bg-card">
          <p className="text-muted-foreground">
            Click a cleanup card above or use the filters to find emails to delete
          </p>
        </div>
      )}

      {/* Permanent Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={selectedEmailIds.length}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
