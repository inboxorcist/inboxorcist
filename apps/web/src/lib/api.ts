import { api } from './axios'

// ============================================================================
// Auth Types
// ============================================================================

export interface User {
  id: string
  email: string
  name: string | null
  picture: string | null
  createdAt: string
}

export interface Session {
  id: string
  current: boolean
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  lastUsedAt: string
}

// ============================================================================
// Auth API
// ============================================================================

interface OAuthUrlResponse {
  url: string
  state: string
}

/**
 * Get the Google OAuth URL and state
 */
export async function getOAuthUrl(
  redirect?: string,
  addAccount = false
): Promise<OAuthUrlResponse> {
  const params = new URLSearchParams()
  if (redirect) params.set('redirect', redirect)
  if (addAccount) params.set('add_account', 'true')
  const query = params.toString()
  const { data } = await api.get<OAuthUrlResponse>(`/api/auth/google${query ? `?${query}` : ''}`)
  return data
}

/**
 * Get the currently authenticated user
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await api.get<User>('/api/auth/me')
    return data
  } catch {
    return null
  }
}

/**
 * Get all active sessions for the current user
 */
export async function getSessions(): Promise<Session[]> {
  const { data } = await api.get<{ sessions: Session[] }>('/api/auth/sessions')
  return data.sessions
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await api.delete(`/api/auth/sessions/${sessionId}`)
}

/**
 * Revoke all sessions except the current one
 */
export async function revokeAllOtherSessions(): Promise<number> {
  const { data } = await api.delete<{ success: boolean; revokedCount: number }>(
    '/api/auth/sessions'
  )
  return data.revokedCount
}

/**
 * Delete the user's account and all data
 * Requires confirmation string "DELETE"
 */
export async function deleteAccount(): Promise<void> {
  await api.delete('/api/auth/account', { data: { confirmation: 'DELETE' } })
}

// ============================================================================
// Types
// ============================================================================

export interface GmailAccount {
  id: string
  email: string
  connectedAt: string
  syncStatus?: string
  syncError?: string | null
  syncStartedAt?: string
  syncCompletedAt?: string
}

export interface TopSender {
  email: string
  name: string | null
  count: number
}

/**
 * Stats calculated from the local emails database
 * (replaces the old cached QuickStats)
 */
export interface QuickStats {
  total: number // Excludes trash and spam
  unread: number // Excludes trash and spam
  categories: {
    promotions: number
    social: number
    updates: number
    forums: number
    primary: number
  }
  size: {
    larger5MB: number
    larger10MB: number
    totalStorageBytes: number
    trashStorageBytes: number
  }
  age: {
    olderThan1Year: number
    olderThan2Years: number
  }
  senders: {
    uniqueCount: number
  }
  // Trash and spam stats
  trash: {
    count: number
    sizeBytes: number
  }
  spam: {
    count: number
    sizeBytes: number
  }
  // Cleanup-ready counts and sizes (excludes trash, spam, starred, important)
  cleanup: {
    promotions: { count: number; size: number }
    social: { count: number; size: number }
    updates: { count: number; size: number }
    forums: { count: number; size: number }
    readPromotions: { count: number; size: number }
    olderThan1Year: { count: number; size: number }
    olderThan2Years: { count: number; size: number }
    larger5MB: { count: number; size: number }
    larger10MB: { count: number; size: number }
  }
}

export interface StatsResponse {
  stats: QuickStats | null
  syncStatus: string
  syncStartedAt: string | null
  syncCompletedAt: string | null
  message?: string
}

export interface SyncProgress {
  jobId?: string
  status: string
  processed: number
  total: number
  percentage: number
  eta: string | null
  message: string
  syncStatus: string
  rate: number | null
}

export interface Sender {
  email: string
  name: string | null
  count: number
  total_size: number
}

export interface AccountsResponse {
  accounts: GmailAccount[]
}

// ============================================================================
// OAuth API
// ============================================================================

export async function getAccounts(): Promise<GmailAccount[]> {
  const { data } = await api.get<AccountsResponse>('/api/oauth/gmail/accounts')
  return data.accounts
}

export async function disconnectAccount(accountId: string): Promise<void> {
  await api.delete(`/api/oauth/gmail/accounts/${accountId}`)
}

// ============================================================================
// Health API
// ============================================================================

export async function checkHealth(): Promise<{
  status: string
  version: string
  database: { type: string; connected: boolean }
}> {
  const { data } = await api.get('/health')
  return data
}

// ============================================================================
// Stats API
// ============================================================================

export async function getAccountStats(accountId: string): Promise<StatsResponse> {
  const { data } = await api.get<StatsResponse>(`/api/gmail/accounts/${accountId}/stats`)
  return data
}

// ============================================================================
// Sync API
// ============================================================================

export async function startSync(accountId: string): Promise<{
  jobId: string
  status: string
  totalMessages: number
  message: string
}> {
  const { data } = await api.post(`/api/gmail/accounts/${accountId}/sync`)
  return data
}

export async function getSyncProgress(accountId: string): Promise<SyncProgress> {
  const { data } = await api.get<SyncProgress>(`/api/gmail/accounts/${accountId}/sync`)
  return data
}

export async function cancelSync(accountId: string): Promise<{
  success: boolean
  message: string
}> {
  const { data } = await api.delete(`/api/gmail/accounts/${accountId}/sync`)
  return data
}

export async function resumeSync(accountId: string): Promise<{
  jobId: string
  status: string
  message: string
}> {
  const { data } = await api.post(`/api/gmail/accounts/${accountId}/sync/resume`)
  return data
}

export interface DeltaSyncResponse {
  type: 'delta' | 'full'
  success: boolean
  added?: number
  deleted?: number
  jobId?: string
  status?: string
  message: string
}

export async function deltaSync(accountId: string): Promise<DeltaSyncResponse> {
  const { data } = await api.post<DeltaSyncResponse>(`/api/gmail/accounts/${accountId}/sync/delta`)
  return data
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
  })
  return data
}

export async function getAccountSummary(accountId: string): Promise<{
  account: GmailAccount
  stats: QuickStats | null
  sync: SyncProgress | null
  topSenders: Sender[] | null
}> {
  const { data } = await api.get(`/api/gmail/accounts/${accountId}/summary`)
  return data
}

// ============================================================================
// Explorer API
// ============================================================================

export interface EmailRecord {
  message_id: string // Provider's message ID
  thread_id: string
  subject: string | null
  snippet: string | null
  from_email: string
  from_name: string | null
  labels: string // JSON array
  category: string | null
  size_bytes: number
  has_attachments: number // 0 or 1
  is_unread: number // 0 or 1
  is_starred: number // 0 or 1
  is_trash: number // 0 or 1
  is_spam: number // 0 or 1
  is_important: number // 0 or 1
  internal_date: number // Unix timestamp in ms
  synced_at: number // Unix timestamp in ms
  unsubscribe_link: string | null // List-Unsubscribe header URL
}

export interface ExplorerFilters {
  sender?: string // Comma-separated email addresses
  senderDomain?: string // Comma-separated domains (e.g., "github.com,spotify.com")
  category?: string
  dateFrom?: number
  dateTo?: number
  sizeMin?: number
  sizeMax?: number
  isUnread?: boolean
  isStarred?: boolean
  hasAttachments?: boolean
  isTrash?: boolean
  isSpam?: boolean
  isImportant?: boolean
  isArchived?: boolean // Emails without INBOX label (not in inbox, trash, or spam)
  search?: string
  sortBy?: 'date' | 'size' | 'sender'
  sortOrder?: 'asc' | 'desc'
}

export interface ExplorerPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface ExplorerResponse {
  emails: EmailRecord[]
  pagination: ExplorerPagination
  filters: ExplorerFilters
  totalSizeBytes: number
}

export interface TrashResponse {
  success: boolean
  trashedCount: number
  failedCount: number
  message: string
}

export async function getExplorerEmails(
  accountId: string,
  filters: ExplorerFilters = {},
  page = 1,
  limit = 50,
  mode: 'browse' | 'cleanup' = 'browse'
): Promise<ExplorerResponse> {
  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
    mode,
  }

  // Add filter params
  if (filters.sender) params.sender = filters.sender
  if (filters.senderDomain) params.senderDomain = filters.senderDomain
  if (filters.category) params.category = filters.category
  if (filters.dateFrom !== undefined) params.dateFrom = String(filters.dateFrom)
  if (filters.dateTo !== undefined) params.dateTo = String(filters.dateTo)
  if (filters.sizeMin !== undefined) params.sizeMin = String(filters.sizeMin)
  if (filters.sizeMax !== undefined) params.sizeMax = String(filters.sizeMax)
  if (filters.isUnread !== undefined) params.isUnread = String(filters.isUnread)
  if (filters.isStarred !== undefined) params.isStarred = String(filters.isStarred)
  if (filters.hasAttachments !== undefined) params.hasAttachments = String(filters.hasAttachments)
  if (filters.isTrash !== undefined) params.isTrash = String(filters.isTrash)
  if (filters.isSpam !== undefined) params.isSpam = String(filters.isSpam)
  if (filters.isImportant !== undefined) params.isImportant = String(filters.isImportant)
  if (filters.isArchived !== undefined) params.isArchived = String(filters.isArchived)
  if (filters.search) params.search = filters.search
  if (filters.sortBy) params.sortBy = filters.sortBy
  if (filters.sortOrder) params.sortOrder = filters.sortOrder

  const { data } = await api.get<ExplorerResponse>(`/api/explorer/accounts/${accountId}/emails`, {
    params,
  })
  return data
}

export async function getExplorerEmailCount(
  accountId: string,
  filters: ExplorerFilters = {}
): Promise<{ count: number; filters: ExplorerFilters }> {
  const params: Record<string, string> = {}

  if (filters.sender) params.sender = filters.sender
  if (filters.category) params.category = filters.category
  if (filters.dateFrom !== undefined) params.dateFrom = String(filters.dateFrom)
  if (filters.dateTo !== undefined) params.dateTo = String(filters.dateTo)
  if (filters.sizeMin !== undefined) params.sizeMin = String(filters.sizeMin)
  if (filters.sizeMax !== undefined) params.sizeMax = String(filters.sizeMax)
  if (filters.isUnread !== undefined) params.isUnread = String(filters.isUnread)
  if (filters.isStarred !== undefined) params.isStarred = String(filters.isStarred)
  if (filters.hasAttachments !== undefined) params.hasAttachments = String(filters.hasAttachments)
  if (filters.isTrash !== undefined) params.isTrash = String(filters.isTrash)
  if (filters.isSpam !== undefined) params.isSpam = String(filters.isSpam)
  if (filters.isImportant !== undefined) params.isImportant = String(filters.isImportant)
  if (filters.isArchived !== undefined) params.isArchived = String(filters.isArchived)
  if (filters.search) params.search = filters.search

  const { data } = await api.get(`/api/explorer/accounts/${accountId}/emails/count`, { params })
  return data
}

export async function trashEmails(
  accountId: string,
  emailIdsOrFilters: string[] | ExplorerFilters
): Promise<TrashResponse> {
  const body = Array.isArray(emailIdsOrFilters)
    ? { emailIds: emailIdsOrFilters }
    : { filters: emailIdsOrFilters }

  const { data } = await api.post<TrashResponse>(
    `/api/explorer/accounts/${accountId}/emails/trash`,
    body
  )
  return data
}

export interface DeleteResponse {
  success: boolean
  deletedCount: number
  message: string
}

export async function permanentlyDeleteEmails(
  accountId: string,
  emailIdsOrFilters: string[] | ExplorerFilters
): Promise<DeleteResponse> {
  const body = Array.isArray(emailIdsOrFilters)
    ? { emailIds: emailIdsOrFilters }
    : { filters: emailIdsOrFilters }

  const { data } = await api.post<DeleteResponse>(
    `/api/explorer/accounts/${accountId}/emails/delete`,
    body
  )
  return data
}

export interface SenderSuggestion {
  type: 'domain' | 'email'
  value: string
  label: string
  count: number
}

export async function getExplorerSenders(
  accountId: string,
  search?: string,
  limit = 20
): Promise<{ suggestions: SenderSuggestion[] }> {
  const params: Record<string, string> = { limit: String(limit) }
  if (search) params.search = search

  const { data } = await api.get(`/api/explorer/accounts/${accountId}/senders`, { params })
  return data
}

export async function getExplorerCategories(accountId: string): Promise<{ categories: string[] }> {
  const { data } = await api.get(`/api/explorer/accounts/${accountId}/categories`)
  return data
}

// ============================================================================
// Subscriptions API
// ============================================================================

export interface Subscription {
  email: string
  name: string | null
  count: number
  total_size: number
  unsubscribe_link: string | null
  first_date: number
  latest_date: number
  isUnsubscribed: boolean
}

export interface SubscriptionFilters {
  search?: string
  minCount?: number
  maxCount?: number
  minSize?: number
  maxSize?: number
  dateFrom?: number
  dateTo?: number
  sortBy?: 'count' | 'size' | 'first_date' | 'latest_date' | 'name'
  sortOrder?: 'asc' | 'desc'
}

export interface SubscriptionsResponse {
  subscriptions: Subscription[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
  filters?: SubscriptionFilters
}

export async function getSubscriptions(
  accountId: string,
  page = 1,
  limit = 50,
  filters: SubscriptionFilters = {}
): Promise<SubscriptionsResponse> {
  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  }

  // Add filter params
  if (filters.search) params.search = filters.search
  if (filters.minCount !== undefined) params.minCount = String(filters.minCount)
  if (filters.maxCount !== undefined) params.maxCount = String(filters.maxCount)
  if (filters.minSize !== undefined) params.minSize = String(filters.minSize)
  if (filters.maxSize !== undefined) params.maxSize = String(filters.maxSize)
  if (filters.dateFrom !== undefined) params.dateFrom = String(filters.dateFrom)
  if (filters.dateTo !== undefined) params.dateTo = String(filters.dateTo)
  if (filters.sortBy) params.sortBy = filters.sortBy
  if (filters.sortOrder) params.sortOrder = filters.sortOrder

  const { data } = await api.get(`/api/explorer/accounts/${accountId}/subscriptions`, { params })
  return data
}

export interface MarkUnsubscribedResponse {
  success: boolean
  message: string
  alreadyUnsubscribed?: boolean
  markedCount?: number
  alreadyUnsubscribedCount?: number
}

export async function markAsUnsubscribed(
  accountId: string,
  senderEmail: string,
  senderName?: string | null
): Promise<MarkUnsubscribedResponse> {
  const { data } = await api.post<MarkUnsubscribedResponse>(
    `/api/explorer/accounts/${accountId}/subscriptions/unsubscribe`,
    { senderEmail, senderName }
  )
  return data
}

export async function bulkMarkAsUnsubscribed(
  accountId: string,
  senders: Array<{ email: string; name?: string | null }>
): Promise<MarkUnsubscribedResponse> {
  const { data } = await api.post<MarkUnsubscribedResponse>(
    `/api/explorer/accounts/${accountId}/subscriptions/unsubscribe`,
    { senders }
  )
  return data
}

// ============================================================================
// Setup API
// ============================================================================

export interface ConfigItem {
  hasValue: boolean
  value: string | null
  source: 'env' | 'database' | 'default'
  isEditable: boolean
}

export interface SetupStatus {
  setupRequired: boolean
  setupCompleted: boolean
  config: {
    google_client_id: ConfigItem
    google_client_secret: ConfigItem
    app_url: ConfigItem
  }
}

export interface SetupConfig {
  google_client_id?: string
  google_client_secret?: string
  app_url?: string
}

export interface SetupResponse {
  success: boolean
  saved?: string[]
  errors?: string[]
  setupCompleted?: boolean
}

export interface ValidateResponse {
  valid: boolean
  error?: string
  message?: string
}

/**
 * Get the current setup status
 * Returns whether setup is required and current config state
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const { data } = await api.get<SetupStatus>('/api/setup/status')
  return data
}

/**
 * Save setup configuration
 * Only saves values that are editable (not set via env)
 */
export async function saveSetupConfig(config: SetupConfig): Promise<SetupResponse> {
  const { data } = await api.post<SetupResponse>('/api/setup', config)
  return data
}

/**
 * Validate Google credentials format
 */
export async function validateSetupCredentials(): Promise<ValidateResponse> {
  const { data } = await api.get<ValidateResponse>('/api/setup/validate')
  return data
}
