import type { ExplorerFilters } from './api'

/**
 * Serialize ExplorerFilters to URLSearchParams
 * Uses the same param names as the API
 * Note: isTrash/isSpam only included when true (false is the default Inbox state)
 * Special: loc=all means show all mail (no trash/spam filtering)
 */
export function filtersToSearchParams(filters: ExplorerFilters, allMail = false): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.sender) params.set('sender', filters.sender)
  if (filters.senderDomain) params.set('senderDomain', filters.senderDomain)
  if (filters.category) params.set('category', filters.category)
  if (filters.search) params.set('search', filters.search)
  if (filters.dateFrom !== undefined) params.set('dateFrom', String(filters.dateFrom))
  if (filters.dateTo !== undefined) params.set('dateTo', String(filters.dateTo))
  if (filters.sizeMin !== undefined) params.set('sizeMin', String(filters.sizeMin))
  if (filters.sizeMax !== undefined) params.set('sizeMax', String(filters.sizeMax))
  if (filters.isUnread !== undefined) params.set('isUnread', String(filters.isUnread))
  if (filters.isStarred !== undefined) params.set('isStarred', String(filters.isStarred))
  if (filters.hasAttachments !== undefined)
    params.set('hasAttachments', String(filters.hasAttachments))
  // Only include isTrash/isSpam when true (false is the default)
  if (filters.isTrash === true) params.set('isTrash', 'true')
  if (filters.isSpam === true) params.set('isSpam', 'true')
  // loc=all means All Mail (include trash and spam)
  if (allMail) params.set('loc', 'all')
  if (filters.isImportant !== undefined) params.set('isImportant', String(filters.isImportant))
  if (filters.sortBy) params.set('sortBy', filters.sortBy)
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)

  return params
}

/**
 * Parse URLSearchParams to ExplorerFilters
 * Uses the same param names as the API
 */
export function searchParamsToFilters(params: URLSearchParams): ExplorerFilters {
  const filters: ExplorerFilters = {}

  const sender = params.get('sender')
  if (sender) filters.sender = sender

  const senderDomain = params.get('senderDomain')
  if (senderDomain) filters.senderDomain = senderDomain

  const category = params.get('category')
  if (category) filters.category = category

  const search = params.get('search')
  if (search) filters.search = search

  const dateFrom = params.get('dateFrom')
  if (dateFrom) filters.dateFrom = parseInt(dateFrom, 10)

  const dateTo = params.get('dateTo')
  if (dateTo) filters.dateTo = parseInt(dateTo, 10)

  const sizeMin = params.get('sizeMin')
  if (sizeMin) filters.sizeMin = parseInt(sizeMin, 10)

  const sizeMax = params.get('sizeMax')
  if (sizeMax) filters.sizeMax = parseInt(sizeMax, 10)

  const isUnread = params.get('isUnread')
  if (isUnread) filters.isUnread = isUnread === 'true'

  const isStarred = params.get('isStarred')
  if (isStarred) filters.isStarred = isStarred === 'true'

  const hasAttachments = params.get('hasAttachments')
  if (hasAttachments) filters.hasAttachments = hasAttachments === 'true'

  const isTrash = params.get('isTrash')
  if (isTrash) filters.isTrash = isTrash === 'true'

  const isSpam = params.get('isSpam')
  if (isSpam) filters.isSpam = isSpam === 'true'

  const isImportant = params.get('isImportant')
  if (isImportant) filters.isImportant = isImportant === 'true'

  const sortBy = params.get('sortBy')
  if (sortBy && (sortBy === 'date' || sortBy === 'size' || sortBy === 'sender')) {
    filters.sortBy = sortBy
  }

  const sortOrder = params.get('sortOrder')
  if (sortOrder && (sortOrder === 'asc' || sortOrder === 'desc')) {
    filters.sortOrder = sortOrder
  }

  // Handle location: loc=all means All Mail, otherwise default to Inbox
  const loc = params.get('loc')
  if (loc === 'all') {
    // All Mail - don't set isTrash/isSpam (both undefined)
  } else if (filters.isTrash === undefined && filters.isSpam === undefined) {
    // Default to Inbox
    filters.isTrash = false
    filters.isSpam = false
  }

  return filters
}

/**
 * Build a URL path with filters as query params
 */
export function buildFilteredUrl(
  basePath: string,
  filters: ExplorerFilters,
  allMail = false
): string {
  const params = filtersToSearchParams(filters, allMail)
  const queryString = params.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

// =============================================================================
// Card to Filter Mappings
// =============================================================================

type StatsCardType =
  | 'total'
  | 'unread'
  | 'primary'
  | 'promotions'
  | 'social'
  | 'updates'
  | 'forums'
  | 'large'
  | 'old'
  | 'trash'

type CleanupCardType =
  | 'promotions'
  | 'social'
  | 'updates'
  | 'forums'
  | 'old_1year'
  | 'old_2years'
  | 'large_5mb'
  | 'large_10mb'
  | 'spam'
  | 'trash'
  | 'read_promotions'

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Stats card → Explorer filters mapping
 * Note: isTrash/isSpam not included - defaults to Inbox (non-trash, non-spam)
 */
export const STATS_CARD_FILTERS: Record<StatsCardType, ExplorerFilters> = {
  total: {}, // All mail
  unread: { isUnread: true },
  primary: { category: 'CATEGORY_PERSONAL' },
  promotions: { category: 'CATEGORY_PROMOTIONS' },
  social: { category: 'CATEGORY_SOCIAL' },
  updates: { category: 'CATEGORY_UPDATES' },
  forums: { category: 'CATEGORY_FORUMS' },
  large: { sizeMin: 10 * 1024 * 1024 },
  old: { dateTo: Date.now() - TWO_YEARS_MS },
  trash: { isTrash: true }, // View trash
}

/**
 * Cleanup card → Cleanup filters mapping
 * Cleanup cards exclude: starred, important, trash, spam
 * This ensures we only target "safe to delete" emails
 */
export const CLEANUP_CARD_FILTERS: Record<CleanupCardType, ExplorerFilters> = {
  // Category cleanup (not starred, not important)
  promotions: { category: 'CATEGORY_PROMOTIONS', isStarred: false, isImportant: false },
  social: { category: 'CATEGORY_SOCIAL', isStarred: false, isImportant: false },
  updates: { category: 'CATEGORY_UPDATES', isStarred: false, isImportant: false },
  forums: { category: 'CATEGORY_FORUMS', isStarred: false, isImportant: false },
  // Read-only promotions (already read, not starred, not important)
  read_promotions: {
    category: 'CATEGORY_PROMOTIONS',
    isUnread: false,
    isStarred: false,
    isImportant: false,
  },
  // Age-based cleanup (not starred, not important)
  old_1year: { dateTo: Date.now() - ONE_YEAR_MS, isStarred: false, isImportant: false },
  old_2years: { dateTo: Date.now() - TWO_YEARS_MS, isStarred: false, isImportant: false },
  // Size-based cleanup (not starred, not important)
  large_5mb: { sizeMin: 5 * 1024 * 1024, isStarred: false, isImportant: false },
  large_10mb: { sizeMin: 10 * 1024 * 1024, isStarred: false, isImportant: false },
  // Spam and Trash cleanup
  spam: { isSpam: true },
  trash: { isTrash: true },
}

/**
 * Get filters for a stats card
 * Returns { filters, allMail } where allMail=true means show all mail including trash/spam
 */
export function getStatsCardFilters(cardType: StatsCardType): {
  filters: ExplorerFilters
  allMail: boolean
} {
  if (cardType === 'total') {
    return { filters: {}, allMail: true }
  }
  if (cardType === 'trash') {
    // Trash view - return isTrash: true without allMail
    return { filters: { isTrash: true }, allMail: false }
  }
  // For date-based filters, recalculate to get current timestamp
  if (cardType === 'old') {
    return { filters: { dateTo: Date.now() - TWO_YEARS_MS }, allMail: false }
  }
  return { filters: STATS_CARD_FILTERS[cardType], allMail: false }
}

/**
 * Get filters for a cleanup card
 * Cleanup filters exclude starred and important emails to protect user's valuable emails
 */
export function getCleanupPresetFilters(cardType: CleanupCardType): ExplorerFilters {
  // For date-based filters, recalculate to get current timestamp
  if (cardType === 'old_1year') {
    return { dateTo: Date.now() - ONE_YEAR_MS, isStarred: false, isImportant: false }
  }
  if (cardType === 'old_2years') {
    return { dateTo: Date.now() - TWO_YEARS_MS, isStarred: false, isImportant: false }
  }
  return CLEANUP_CARD_FILTERS[cardType]
}
