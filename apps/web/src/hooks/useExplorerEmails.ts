import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getExplorerEmails,
  trashEmails,
  type EmailRecord,
  type ExplorerFilters,
  type ExplorerPagination,
} from "@/lib/api";

interface UseExplorerEmailsResult {
  emails: EmailRecord[];
  pagination: ExplorerPagination | null;
  isLoading: boolean;
  error: string | null;
  filters: ExplorerFilters;
  setFilters: (filters: ExplorerFilters) => void;
  page: number;
  setPage: (page: number) => void;
  refetch: () => void;
  // Selection
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isAllSelected: boolean;
  // Trash action
  trashSelected: () => Promise<{ success: boolean; message: string }>;
  isTrashLoading: boolean;
}

export function useExplorerEmails(accountId: string | null): UseExplorerEmailsResult {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [pagination, setPagination] = useState<ExplorerPagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExplorerFilters>({ isTrash: false, isSpam: false });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTrashLoading, setIsTrashLoading] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [filters]);

  // Reset selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    if (!accountId) {
      setEmails([]);
      setPagination(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getExplorerEmails(accountId, filters, page, 50);
      setEmails(response.emails);
      setPagination(response.pagination);
    } catch (err) {
      console.error("[useExplorerEmails] Error fetching emails:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch emails");
      setEmails([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, filters, page]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(emails.map((e) => e.gmail_id)));
  }, [emails]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useMemo(() => {
    return emails.length > 0 && selectedIds.size === emails.length;
  }, [emails.length, selectedIds.size]);

  // Trash selected emails
  const trashSelected = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!accountId || selectedIds.size === 0) {
      return { success: false, message: "No emails selected" };
    }

    setIsTrashLoading(true);

    try {
      const result = await trashEmails(accountId, Array.from(selectedIds));

      // Refetch to update the list
      await fetchEmails();

      // Clear selection after successful trash
      setSelectedIds(new Set());

      return {
        success: result.success,
        message: result.message,
      };
    } catch (err) {
      console.error("[useExplorerEmails] Error trashing emails:", err);
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to trash emails",
      };
    } finally {
      setIsTrashLoading(false);
    }
  }, [accountId, selectedIds, fetchEmails]);

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
  };
}
