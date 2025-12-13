import { api } from "./axios";

// ============================================================================
// Types
// ============================================================================

export interface GmailAccount {
  id: string;
  email: string;
  connectedAt: string;
  syncStatus?: string;
  syncError?: string | null;
  totalEmails?: number;
  syncStartedAt?: string;
  syncCompletedAt?: string;
}

export interface TopSender {
  email: string;
  name: string | null;
  count: number;
}

export interface QuickStats {
  total: number;
  categories: {
    promotions: number;
    social: number;
    updates: number;
    forums: number;
    primary: number;
  };
  size: {
    larger5MB: number | null;
    larger10MB: number | null;
    totalStorageBytes: number | null;
  };
  age: {
    olderThan1Year: number | null;
    olderThan2Years: number | null;
    olderThan3Years: number | null;
  };
  senders: {
    uniqueCount: number | null;
    topSenders: TopSender[] | null;
  };
  unread: number;
  messagesTotal: number;
  analysisComplete: boolean;
}

export interface StatsResponse {
  stats: QuickStats;
  cached: boolean;
  fetchedAt: string;
  syncStatus: string;
  syncStartedAt: string | null;
  syncCompletedAt: string | null;
}

export interface SyncProgress {
  jobId?: string;
  status: string;
  processed: number;
  total: number;
  percentage: number;
  eta: string | null;
  phase: string;
  message: string;
  syncStatus: string;
}

export interface Sender {
  email: string;
  name: string | null;
  count: number;
  total_size: number;
}

export interface AccountsResponse {
  accounts: GmailAccount[];
}

export interface AuthUrlResponse {
  url: string;
}

// ============================================================================
// OAuth API
// ============================================================================

export async function getAuthUrl(): Promise<string> {
  const { data } = await api.get<AuthUrlResponse>("/oauth/gmail");
  return data.url;
}

export async function getAccounts(): Promise<GmailAccount[]> {
  const { data } = await api.get<AccountsResponse>("/oauth/gmail/accounts");
  return data.accounts;
}

export async function disconnectAccount(accountId: string): Promise<void> {
  await api.delete(`/oauth/gmail/accounts/${accountId}`);
}

// ============================================================================
// Health API
// ============================================================================

export async function checkHealth(): Promise<{
  status: string;
  database: { type: string; connected: boolean };
}> {
  const { data } = await api.get("/api/health");
  return data;
}

// ============================================================================
// Stats API
// ============================================================================

export async function getAccountStats(accountId: string): Promise<StatsResponse> {
  const { data } = await api.get<StatsResponse>(`/api/gmail/accounts/${accountId}/stats`);
  return data;
}

// ============================================================================
// Sync API
// ============================================================================

export async function startSync(accountId: string): Promise<{
  jobId: string;
  status: string;
  totalMessages: number;
  message: string;
}> {
  const { data } = await api.post(`/api/gmail/accounts/${accountId}/sync`);
  return data;
}

export async function getSyncProgress(accountId: string): Promise<SyncProgress> {
  const { data } = await api.get<SyncProgress>(`/api/gmail/accounts/${accountId}/sync`);
  return data;
}

export async function cancelSync(accountId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const { data } = await api.delete(`/api/gmail/accounts/${accountId}/sync`);
  return data;
}

export async function resumeSync(accountId: string): Promise<{
  jobId: string;
  status: string;
  message: string;
}> {
  const { data } = await api.post(`/api/gmail/accounts/${accountId}/sync/resume`);
  return data;
}

export interface DeltaSyncResponse {
  type: "delta" | "full";
  success: boolean;
  added?: number;
  deleted?: number;
  jobId?: string;
  status?: string;
  message: string;
}

export async function deltaSync(accountId: string): Promise<DeltaSyncResponse> {
  const { data } = await api.post<DeltaSyncResponse>(`/api/gmail/accounts/${accountId}/sync/delta`);
  return data;
}

// ============================================================================
// Data API
// ============================================================================

export async function getTopSenders(
  accountId: string,
  limit = 50
): Promise<{ senders: Sender[]; totalEmails: number }> {
  const { data } = await api.get(`/api/gmail/accounts/${accountId}/senders`, {
    params: { limit },
  });
  return data;
}

export async function getAccountSummary(accountId: string): Promise<{
  account: GmailAccount;
  stats: QuickStats | null;
  statsFetchedAt: string | null;
  sync: SyncProgress | null;
  topSenders: Sender[] | null;
}> {
  const { data } = await api.get(`/api/gmail/accounts/${accountId}/summary`);
  return data;
}

// ============================================================================
// Explorer API
// ============================================================================

export interface EmailRecord {
  gmail_id: string;
  thread_id: string;
  subject: string | null;
  snippet: string | null;
  from_email: string;
  from_name: string | null;
  labels: string; // JSON array
  category: string | null;
  size_bytes: number;
  has_attachments: number; // 0 or 1
  is_unread: number; // 0 or 1
  is_starred: number; // 0 or 1
  is_trash: number; // 0 or 1
  is_spam: number; // 0 or 1
  is_important: number; // 0 or 1
  internal_date: number; // Unix timestamp in ms
  synced_at: number; // Unix timestamp in ms
}

export interface ExplorerFilters {
  sender?: string;
  category?: string;
  dateFrom?: number;
  dateTo?: number;
  sizeMin?: number;
  sizeMax?: number;
  isUnread?: boolean;
  isStarred?: boolean;
  hasAttachments?: boolean;
  isTrash?: boolean;
  isSpam?: boolean;
  isImportant?: boolean;
  search?: string;
  sortBy?: "date" | "size" | "sender";
  sortOrder?: "asc" | "desc";
}

export interface ExplorerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ExplorerResponse {
  emails: EmailRecord[];
  pagination: ExplorerPagination;
  filters: ExplorerFilters;
}

export interface TrashResponse {
  success: boolean;
  trashedCount: number;
  failedCount: number;
  message: string;
}

export async function getExplorerEmails(
  accountId: string,
  filters: ExplorerFilters = {},
  page = 1,
  limit = 50
): Promise<ExplorerResponse> {
  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  };

  // Add filter params
  if (filters.sender) params.sender = filters.sender;
  if (filters.category) params.category = filters.category;
  if (filters.dateFrom !== undefined) params.dateFrom = String(filters.dateFrom);
  if (filters.dateTo !== undefined) params.dateTo = String(filters.dateTo);
  if (filters.sizeMin !== undefined) params.sizeMin = String(filters.sizeMin);
  if (filters.sizeMax !== undefined) params.sizeMax = String(filters.sizeMax);
  if (filters.isUnread !== undefined) params.isUnread = String(filters.isUnread);
  if (filters.isStarred !== undefined) params.isStarred = String(filters.isStarred);
  if (filters.hasAttachments !== undefined) params.hasAttachments = String(filters.hasAttachments);
  if (filters.isTrash !== undefined) params.isTrash = String(filters.isTrash);
  if (filters.isSpam !== undefined) params.isSpam = String(filters.isSpam);
  if (filters.isImportant !== undefined) params.isImportant = String(filters.isImportant);
  if (filters.search) params.search = filters.search;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.sortOrder) params.sortOrder = filters.sortOrder;

  const { data } = await api.get<ExplorerResponse>(
    `/api/explorer/accounts/${accountId}/emails`,
    { params }
  );
  return data;
}

export async function getExplorerEmailCount(
  accountId: string,
  filters: ExplorerFilters = {}
): Promise<{ count: number; filters: ExplorerFilters }> {
  const params: Record<string, string> = {};

  if (filters.sender) params.sender = filters.sender;
  if (filters.category) params.category = filters.category;
  if (filters.dateFrom !== undefined) params.dateFrom = String(filters.dateFrom);
  if (filters.dateTo !== undefined) params.dateTo = String(filters.dateTo);
  if (filters.sizeMin !== undefined) params.sizeMin = String(filters.sizeMin);
  if (filters.sizeMax !== undefined) params.sizeMax = String(filters.sizeMax);
  if (filters.isUnread !== undefined) params.isUnread = String(filters.isUnread);
  if (filters.isStarred !== undefined) params.isStarred = String(filters.isStarred);
  if (filters.hasAttachments !== undefined) params.hasAttachments = String(filters.hasAttachments);
  if (filters.isTrash !== undefined) params.isTrash = String(filters.isTrash);
  if (filters.isSpam !== undefined) params.isSpam = String(filters.isSpam);
  if (filters.isImportant !== undefined) params.isImportant = String(filters.isImportant);
  if (filters.search) params.search = filters.search;

  const { data } = await api.get(`/api/explorer/accounts/${accountId}/emails/count`, { params });
  return data;
}

export async function trashEmails(
  accountId: string,
  emailIds: string[]
): Promise<TrashResponse> {
  const { data } = await api.post<TrashResponse>(
    `/api/explorer/accounts/${accountId}/emails/trash`,
    { emailIds }
  );
  return data;
}

export async function getExplorerSenders(
  accountId: string,
  search?: string,
  limit = 20
): Promise<{ senders: string[] }> {
  const params: Record<string, string> = { limit: String(limit) };
  if (search) params.search = search;

  const { data } = await api.get(`/api/explorer/accounts/${accountId}/senders`, { params });
  return data;
}

export async function getExplorerCategories(
  accountId: string
): Promise<{ categories: string[] }> {
  const { data } = await api.get(`/api/explorer/accounts/${accountId}/categories`);
  return data;
}
