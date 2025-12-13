import { useState, useCallback, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type RowSelectionState,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { useExplorerEmails } from "@/hooks/useExplorerEmails";
import type { ExplorerFilters, EmailRecord } from "@/lib/api";
import { getExplorerSenders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  Mail,
  Paperclip,
  Star,
  Loader2,
  AlertOctagon,
  Inbox,
  Tag,
  HardDrive,
  MailOpen,
  User,
  ChevronsUp,
} from "lucide-react";
import { SyncStatusBar } from "./SyncStatusBar";
import { SyncProgress } from "./SyncProgress";
import { useLanguage } from "@/hooks/useLanguage";
import { useOutletContext } from "react-router-dom";
import type { SyncProgress as SyncProgressType } from "@/lib/api";

interface OutletContext {
  syncProgress: SyncProgressType | null;
  isSyncLoading: boolean;
  onResumeSync: () => void;
  isSyncing: boolean;
}

interface ExplorerPageProps {
  accountId: string;
  syncStatus: string | null;
  syncStartedAt?: string | null;
  syncCompletedAt?: string | null;
  onSyncComplete?: () => void;
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Format date to human readable
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

// Get category display name and color
function getCategoryInfo(category: string | null): { label: string; color: string } {
  const categoryMap: Record<string, { label: string; color: string }> = {
    CATEGORY_PROMOTIONS: { label: "Promotions", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
    CATEGORY_SOCIAL: { label: "Social", color: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
    CATEGORY_UPDATES: { label: "Updates", color: "bg-purple-500/20 text-purple-700 dark:text-purple-400" },
    CATEGORY_FORUMS: { label: "Forums", color: "bg-green-500/20 text-green-700 dark:text-green-400" },
    CATEGORY_PERSONAL: { label: "Primary", color: "bg-gray-500/20 text-gray-700 dark:text-gray-400" },
    SENT: { label: "Sent", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
    SPAM: { label: "Spam", color: "bg-red-500/20 text-red-700 dark:text-red-400" },
    TRASH: { label: "Trash", color: "bg-orange-500/20 text-orange-700 dark:text-orange-400" },
  };

  if (!category) return { label: "Other", color: "bg-gray-500/20 text-gray-600 dark:text-gray-400" };
  return categoryMap[category] || { label: category.replace("CATEGORY_", ""), color: "bg-gray-500/20 text-gray-600" };
}

const columnHelper = createColumnHelper<EmailRecord>();

export function ExplorerPage({
  accountId,
  syncStatus,
  syncStartedAt,
  syncCompletedAt,
  onSyncComplete,
}: ExplorerPageProps) {
  const { t } = useLanguage();
  const outletContext = useOutletContext<OutletContext>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

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
    isTrashLoading,
  } = useExplorerEmails(accountId);

  // Filter state (local before applying)
  const [searchInput, setSearchInput] = useState("");

  // Sender multi-select state
  const [selectedSenders, setSelectedSenders] = useState<string[]>([]);
  const [senderOptions, setSenderOptions] = useState<string[]>([]);
  const [senderSearch, setSenderSearch] = useState("");
  const [isSendersLoading, setIsSendersLoading] = useState(false);

  // Fetch senders for the dropdown
  useEffect(() => {
    if (syncStatus !== "completed") return;

    const fetchSenders = async () => {
      setIsSendersLoading(true);
      try {
        const { senders } = await getExplorerSenders(accountId, senderSearch, 50);
        setSenderOptions(senders);
      } catch (err) {
        console.error("Failed to fetch senders:", err);
      } finally {
        setIsSendersLoading(false);
      }
    };

    const debounce = setTimeout(fetchSenders, 300);
    return () => clearTimeout(debounce);
  }, [accountId, senderSearch, syncStatus]);

  // Get selected email IDs from row selection
  const selectedEmailIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((index) => emails[parseInt(index)]?.gmail_id)
      .filter(Boolean) as string[];
  }, [rowSelection, emails]);

  // Apply search filter
  const handleSearch = useCallback(() => {
    setFilters({
      ...filters,
      search: searchInput || undefined,
      sender: selectedSenders.length > 0 ? selectedSenders.join(",") : undefined,
    });
  }, [filters, setFilters, searchInput, selectedSenders]);

  // Handle Enter key on search
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchInput("");
    setSelectedSenders([]);
  }, [setFilters]);

  // Update filter
  const updateFilter = useCallback(
    <K extends keyof ExplorerFilters>(key: K, value: ExplorerFilters[K] | undefined) => {
      const newFilters = { ...filters };
      if (value === undefined) {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      setFilters(newFilters);
    },
    [filters, setFilters]
  );

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    const { trashEmails } = await import("@/lib/api");
    try {
      const result = await trashEmails(accountId, selectedEmailIds);
      setDeleteResult({ success: result.success, message: result.message });
      setRowSelection({});
      refetch();
    } catch (err) {
      setDeleteResult({ success: false, message: err instanceof Error ? err.message : "Failed to trash emails" });
    }
    setShowDeleteDialog(false);
  }, [accountId, selectedEmailIds, refetch]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      !!filters.sender ||
      !!filters.category ||
      !!filters.search ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      filters.sizeMin !== undefined ||
      filters.sizeMax !== undefined ||
      filters.isUnread !== undefined ||
      filters.isStarred !== undefined ||
      filters.hasAttachments !== undefined ||
      filters.isTrash !== undefined ||
      filters.isSpam !== undefined ||
      filters.isImportant !== undefined
    );
  }, [filters]);

  // Define columns
  const columns = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }: { table: ReturnType<typeof useReactTable<EmailRecord>> }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }: { row: { getIsSelected: () => boolean; toggleSelected: (value: boolean) => void } }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
      },
      columnHelper.accessor("from_email", {
        header: "From",
        cell: ({ row }) => {
          const email = row.original;
          return (
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className={`truncate text-sm ${email.is_unread === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {email.from_name || email.from_email}
                </p>
                <p className="text-xs text-muted-foreground truncate">{email.from_email}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {email.is_spam === 1 && (
                  <span title="Spam"><AlertOctagon className="h-3.5 w-3.5 text-red-500" /></span>
                )}
                {email.is_trash === 1 && (
                  <span title="Trash"><Trash2 className="h-3.5 w-3.5 text-orange-500" /></span>
                )}
                {email.is_important === 1 && (
                  <span title="Important"><ChevronsUp className="h-3.5 w-3.5 text-amber-500" /></span>
                )}
                {email.is_starred === 1 && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                {email.has_attachments === 1 && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </div>
          );
        },
        size: 200,
        minSize: 100,
        maxSize: 320,
      }),
      columnHelper.accessor("subject", {
        header: "Subject",
        cell: ({ row }) => {
          const email = row.original;
          return (
            <div className="min-w-0 overflow-hidden">
              <p className={`truncate text-sm ${email.is_unread === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {email.subject || "(No subject)"}
              </p>
              {email.snippet && <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>}
            </div>
          );
        },
        // Subject takes remaining space - no fixed size
        minSize: 150,
        maxSize: 9999,
        enableResizing: false,
      }),
      columnHelper.accessor("category", {
        header: "Category",
        cell: ({ getValue }) => {
          const categoryInfo = getCategoryInfo(getValue());
          return (
            <Badge variant="secondary" className={`text-xs whitespace-nowrap ${categoryInfo.color}`}>
              {categoryInfo.label}
            </Badge>
          );
        },
        size: 110,
        minSize: 80,
        maxSize: 140,
      }),
      columnHelper.accessor("size_bytes", {
        header: "Size",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">{formatBytes(getValue())}</span>
        ),
        size: 70,
        minSize: 50,
        maxSize: 100,
      }),
      columnHelper.accessor("internal_date", {
        header: () => <div className="text-right">Date</div>,
        cell: ({ getValue }) => (
          <div className="text-sm text-muted-foreground text-right whitespace-nowrap">{formatDate(getValue())}</div>
        ),
        size: 100,
        minSize: 70,
        maxSize: 130,
      }),
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: emails,
    columns,
    state: {
      rowSelection,
      columnSizing,
    },
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.gmail_id,
  });

  const { rows } = table.getRowModel();

  // Check if sync is not yet completed
  const isSyncPending = syncStatus !== "completed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("explorer.title")}</h1>
          <p className="text-muted-foreground">{t("explorer.description")}</p>
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
      {outletContext?.isSyncing && (
        <SyncProgress
          progress={outletContext.syncProgress}
          isLoading={outletContext.isSyncLoading}
          onResume={outletContext.onResumeSync}
          showSkeleton={outletContext.isSyncing}
        />
      )}

      {/* Selected emails action bar */}
      {selectedEmailIds.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isTrashLoading}
          >
            {isTrashLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Trash {selectedEmailIds.length} selected
          </Button>
        </div>
      )}

      {/* Delete result toast */}
      {deleteResult && (
        <div
          className={`p-4 rounded-lg ${
            deleteResult.success
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-red-500/10 text-red-700 dark:text-red-400"
          }`}
        >
          {deleteResult.message}
          <button className="ml-2 hover:underline" onClick={() => setDeleteResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 p-4 bg-card rounded-lg border">
        {/* Search Row */}
        <div className="flex items-center gap-3">
          {/* Location/Mailbox */}
          <Select
            value={
              filters.isTrash === true
                ? "trash"
                : filters.isSpam === true
                  ? "spam"
                  : filters.isTrash === false && filters.isSpam === false
                    ? "inbox"
                    : "all"
            }
            onValueChange={(v) => {
              if (v === "all") {
                const newFilters = { ...filters };
                delete newFilters.isTrash;
                delete newFilters.isSpam;
                setFilters(newFilters);
              } else if (v === "inbox") {
                setFilters({ ...filters, isTrash: false, isSpam: false });
              } else if (v === "spam") {
                const newFilters = { ...filters, isSpam: true };
                delete newFilters.isTrash;
                setFilters(newFilters);
              } else if (v === "trash") {
                const newFilters = { ...filters, isTrash: true };
                delete newFilters.isSpam;
                setFilters(newFilters);
              }
            }}
          >
            <SelectTrigger className="w-[140px]">
              <Inbox className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mail</SelectItem>
              <SelectItem value="inbox">Inbox</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
              <SelectItem value="trash">Trash</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("explorer.searchSubject")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9"
            />
          </div>
          <MultiSelect
            options={senderOptions.map((s) => ({ value: s, label: s }))}
            selected={selectedSenders}
            onChange={setSelectedSenders}
            placeholder={t("explorer.filterBySender")}
            searchPlaceholder={t("explorer.searchSenders")}
            emptyMessage={isSendersLoading ? "Loading..." : t("explorer.noSendersFound")}
            isLoading={isSendersLoading}
            onSearchChange={setSenderSearch}
            icon={<User className="h-4 w-4 text-muted-foreground" />}
            className="flex-1"
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            {t("explorer.search")}
          </Button>
          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="shrink-0"
          >
            <X className="h-4 w-4 mr-2" />
            {t("explorer.clearAll")}
          </Button>
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-3">
          {/* Category */}
          <Select
            value={filters.category || "all"}
            onValueChange={(v) => updateFilter("category", v === "all" ? undefined : v)}
          >
            <SelectTrigger className="flex-1">
              <Tag className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="CATEGORY_PROMOTIONS">Promotions</SelectItem>
              <SelectItem value="CATEGORY_SOCIAL">Social</SelectItem>
              <SelectItem value="CATEGORY_UPDATES">Updates</SelectItem>
              <SelectItem value="CATEGORY_FORUMS">Forums</SelectItem>
              <SelectItem value="CATEGORY_PERSONAL">Primary</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
            </SelectContent>
          </Select>

          {/* Size */}
          <Select
            value={filters.sizeMin ? String(filters.sizeMin) : "all"}
            onValueChange={(v) => updateFilter("sizeMin", v === "all" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="flex-1">
              <HardDrive className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Size</SelectItem>
              <SelectItem value="1048576">&gt; 1 MB</SelectItem>
              <SelectItem value="5242880">&gt; 5 MB</SelectItem>
              <SelectItem value="10485760">&gt; 10 MB</SelectItem>
            </SelectContent>
          </Select>

          {/* Read status */}
          <Select
            value={filters.isUnread === undefined ? "all" : filters.isUnread ? "unread" : "read"}
            onValueChange={(v) => updateFilter("isUnread", v === "all" ? undefined : v === "unread")}
          >
            <SelectTrigger className="flex-1">
              <MailOpen className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Status</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>

          {/* Starred */}
          <Select
            value={filters.isStarred === undefined ? "all" : filters.isStarred ? "starred" : "not-starred"}
            onValueChange={(v) => updateFilter("isStarred", v === "all" ? undefined : v === "starred")}
          >
            <SelectTrigger className="flex-1">
              <Star className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Starred" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="starred">Starred</SelectItem>
              <SelectItem value="not-starred">Not Starred</SelectItem>
            </SelectContent>
          </Select>

          {/* Important */}
          <Select
            value={filters.isImportant === undefined ? "all" : filters.isImportant ? "important" : "not-important"}
            onValueChange={(v) => updateFilter("isImportant", v === "all" ? undefined : v === "important")}
          >
            <SelectTrigger className="flex-1">
              <ChevronsUp className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Important" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="important">Important</SelectItem>
              <SelectItem value="not-important">Not Important</SelectItem>
            </SelectContent>
          </Select>

          {/* Attachments */}
          <Select
            value={filters.hasAttachments === undefined ? "all" : filters.hasAttachments ? "yes" : "no"}
            onValueChange={(v) => updateFilter("hasAttachments", v === "all" ? undefined : v === "yes")}
          >
            <SelectTrigger className="flex-1">
              <Paperclip className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Attachments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="yes">Has Attachments</SelectItem>
              <SelectItem value="no">No Attachments</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pagination - Above table (hide when sync pending) */}
      {pagination && !isSyncPending && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total > 0 ? (
              <>
                {t("explorer.showing")} {(page - 1) * pagination.limit + 1} -{" "}
                {Math.min(page * pagination.limit, pagination.total)} {t("explorer.of")}{" "}
                {pagination.total.toLocaleString()} {t("explorer.emails")}
              </>
            ) : (
              t("explorer.noEmails")
            )}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(1)}
              disabled={page === 1 || isLoading}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(page - 1)}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-4 text-sm">
              {t("explorer.page")} {page} {t("explorer.of")} {pagination.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(pagination.totalPages)}
              disabled={page >= pagination.totalPages || isLoading}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {error && error !== "Sync not complete" ? (
          <div className="p-8 text-center text-red-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="p-12 text-center">
            {isSyncPending ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">{t("explorer.syncPending.title")}</h3>
                <p className="text-muted-foreground text-center max-w-sm mx-auto">
                  {t("explorer.syncPending.description")}
                </p>
              </>
            ) : (
              <>
                <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">{t("explorer.noEmails")}</p>
                <p className="text-sm text-muted-foreground/70">{t("explorer.noEmails.description")}</p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    {t("explorer.clearAll")}
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <Table className="table-fixed w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canResize = header.column.getCanResize();
                    const isFlexColumn = header.column.id === "subject";
                    return (
                      <TableHead
                        key={header.id}
                        style={isFlexColumn ? undefined : { width: header.getSize() }}
                        className={`relative group ${isFlexColumn ? "w-auto" : ""}`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {/* Resize handle */}
                        {canResize && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none hover:bg-primary/50 ${
                              header.column.getIsResizing() ? "bg-primary" : ""
                            }`}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isFlexColumn = cell.column.id === "subject";
                    return (
                      <TableCell
                        key={cell.id}
                        style={isFlexColumn ? undefined : { width: cell.column.getSize() }}
                        className={`overflow-hidden ${isFlexColumn ? "w-auto" : ""}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {selectedEmailIds.length} email{selectedEmailIds.length > 1 ? "s" : ""} to
              your Gmail trash. You can recover them from trash within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
