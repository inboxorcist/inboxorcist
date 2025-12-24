import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  MailMinus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  Search,
  X,
  HardDrive,
  ArrowUpDown,
  CalendarIcon,
  Clock,
  Hash,
  CheckSquare,
  Loader2,
  ExternalLink,
  Mail,
} from 'lucide-react'
import {
  getSubscriptions,
  bulkMarkAsUnsubscribed,
  type Subscription,
  type SubscriptionFilters,
} from '@/lib/api'
import {
  buildFilteredUrl,
  subscriptionFiltersToSearchParams,
  searchParamsToSubscriptionFilters,
} from '@/lib/filter-url'
import { queryKeys } from '@/lib/query-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UnsubscribeConfirmDialog } from './UnsubscribeConfirmDialog'
import { SyncStatusBar } from './SyncStatusBar'
import { SyncProgress } from './SyncProgress'
import { useAppContext } from '@/routes/__root'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'

interface SubscriptionsPageProps {
  accountId: string
  syncStatus: string | null
  syncStartedAt?: string | null
  syncCompletedAt?: string | null
  onSyncComplete?: () => void
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Format date to relative string
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

// Date preset definitions
type DatePreset =
  | 'any'
  | '7days'
  | '30days'
  | '90days'
  | '1year'
  | 'older1year'
  | 'older2years'
  | 'custom'

const DATE_PRESETS: Record<
  Exclude<DatePreset, 'any' | 'custom'>,
  { label: string; getRange: () => { dateFrom?: number; dateTo?: number } }
> = {
  '7days': {
    label: 'Last 7 days',
    getRange: () => ({ dateFrom: Date.now() - 7 * 24 * 60 * 60 * 1000 }),
  },
  '30days': {
    label: 'Last 30 days',
    getRange: () => ({ dateFrom: Date.now() - 30 * 24 * 60 * 60 * 1000 }),
  },
  '90days': {
    label: 'Last 90 days',
    getRange: () => ({ dateFrom: Date.now() - 90 * 24 * 60 * 60 * 1000 }),
  },
  '1year': {
    label: 'Last year',
    getRange: () => ({ dateFrom: Date.now() - 365 * 24 * 60 * 60 * 1000 }),
  },
  older1year: {
    label: 'Older than 1 year',
    getRange: () => ({ dateTo: Date.now() - 365 * 24 * 60 * 60 * 1000 }),
  },
  older2years: {
    label: 'Older than 2 years',
    getRange: () => ({ dateTo: Date.now() - 2 * 365 * 24 * 60 * 60 * 1000 }),
  },
}

function detectDatePreset(dateFrom?: number, dateTo?: number): DatePreset {
  if (dateFrom === undefined && dateTo === undefined) {
    return 'any'
  }

  const tolerance = 60 * 60 * 1000 // 1 hour tolerance for matching

  for (const [key, preset] of Object.entries(DATE_PRESETS)) {
    const range = preset.getRange()
    const fromMatches =
      range.dateFrom === undefined
        ? dateFrom === undefined
        : dateFrom !== undefined && Math.abs(range.dateFrom - dateFrom) < tolerance
    const toMatches =
      range.dateTo === undefined
        ? dateTo === undefined
        : dateTo !== undefined && Math.abs(range.dateTo - dateTo) < tolerance

    if (fromMatches && toMatches) {
      return key as DatePreset
    }
  }

  return 'custom'
}

interface SubscriptionRowProps {
  subscription: Subscription
  isSelected: boolean
  onSelectChange: (checked: boolean) => void
  onUnsubscribeClick: (subscription: Subscription) => void
}

function SubscriptionRow({
  subscription,
  isSelected,
  onSelectChange,
  onUnsubscribeClick,
}: SubscriptionRowProps) {
  const { t } = useLanguage()
  return (
    <TableRow className={subscription.isUnsubscribed ? 'opacity-60' : ''}>
      <TableCell className="py-2 w-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelectChange}
          disabled={subscription.isUnsubscribed}
        />
      </TableCell>
      <TableCell className="py-2">
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-sm truncate">
            {subscription.name || subscription.email}
          </span>
          {subscription.name && (
            <span className="text-xs text-muted-foreground truncate">{subscription.email}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2 text-center">
        <span className="text-sm text-muted-foreground tabular-nums">
          {subscription.count.toLocaleString()}
        </span>
      </TableCell>
      <TableCell className="py-2 text-center">
        <span className="text-sm text-muted-foreground">
          {formatBytes(subscription.total_size)}
        </span>
      </TableCell>
      <TableCell className="py-2 text-center">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(subscription.first_date)}
        </span>
      </TableCell>
      <TableCell className="py-2 text-center">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(subscription.latest_date)}
        </span>
      </TableCell>
      <TableCell className="py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              const url = buildFilteredUrl('/explorer', { sender: subscription.email }, true)
              window.open(url, '_blank', 'noopener,noreferrer')
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('subscriptions.view')}
          </Button>
          {subscription.isUnsubscribed ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5" />
              {t('subscriptions.unsubscribed')}
            </span>
          ) : subscription.unsubscribe_link ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUnsubscribeClick(subscription)}
              className="gap-1.5 text-orange-500 border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-500"
            >
              <MailMinus className="h-3.5 w-3.5" />
              {t('subscriptions.unsubscribe')}
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  )
}

interface SubscriptionFiltersUIProps {
  filters: SubscriptionFilters
  onFiltersChange: (filters: SubscriptionFilters) => void
  disabled?: boolean
}

function SubscriptionFiltersUI({
  filters,
  onFiltersChange,
  disabled = false,
}: SubscriptionFiltersUIProps) {
  const { t } = useLanguage()
  const [searchInput, setSearchInput] = useState(filters.search || '')

  const handleSearch = useCallback(() => {
    onFiltersChange({
      ...filters,
      search: searchInput || undefined,
    })
  }, [filters, onFiltersChange, searchInput])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    },
    [handleSearch]
  )

  const clearFilters = useCallback(() => {
    onFiltersChange({})
    setSearchInput('')
  }, [onFiltersChange])

  const updateFilter = useCallback(
    <K extends keyof SubscriptionFilters>(key: K, value: SubscriptionFilters[K] | undefined) => {
      const newFilters = { ...filters }
      if (value === undefined) {
        delete newFilters[key]
      } else {
        newFilters[key] = value
      }
      onFiltersChange(newFilters)
    },
    [filters, onFiltersChange]
  )

  const hasActiveFilters = useMemo(() => {
    return (
      !!filters.search ||
      filters.minCount !== undefined ||
      filters.maxCount !== undefined ||
      filters.minSize !== undefined ||
      filters.maxSize !== undefined ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      (filters.sortBy && filters.sortBy !== 'count') ||
      (filters.sortOrder && filters.sortOrder !== 'desc')
    )
  }, [filters])

  return (
    <div className="space-y-3 p-4 bg-card rounded-lg border">
      {/* Search Row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('subscriptions.search.placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <Button onClick={handleSearch} disabled={disabled}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
        <Button
          variant="ghost"
          onClick={clearFilters}
          disabled={!hasActiveFilters || disabled}
          className="shrink-0"
        >
          <X className="h-4 w-4 mr-2" />
          Clear All
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3">
        {/* Email Count */}
        <Select
          value={filters.minCount ? String(filters.minCount) : 'all'}
          onValueChange={(v) => updateFilter('minCount', v === 'all' ? undefined : parseInt(v))}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <Hash className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Email Count" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Count</SelectItem>
            <SelectItem value="5">&gt; 5 emails</SelectItem>
            <SelectItem value="10">&gt; 10 emails</SelectItem>
            <SelectItem value="50">&gt; 50 emails</SelectItem>
            <SelectItem value="100">&gt; 100 emails</SelectItem>
          </SelectContent>
        </Select>

        {/* Size */}
        <Select
          value={filters.minSize ? String(filters.minSize) : 'all'}
          onValueChange={(v) => updateFilter('minSize', v === 'all' ? undefined : parseInt(v))}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <HardDrive className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Size</SelectItem>
            <SelectItem value="1048576">&gt; 1 MB</SelectItem>
            <SelectItem value="10485760">&gt; 10 MB</SelectItem>
            <SelectItem value="104857600">&gt; 100 MB</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Preset */}
        <Select
          value={detectDatePreset(filters.dateFrom, filters.dateTo)}
          onValueChange={(v: DatePreset) => {
            if (v === 'any') {
              const newFilters = { ...filters }
              delete newFilters.dateFrom
              delete newFilters.dateTo
              onFiltersChange(newFilters)
            } else if (v === 'custom') {
              // Don't change anything for custom
            } else {
              const preset = DATE_PRESETS[v]
              const range = preset.getRange()
              const newFilters = { ...filters }
              if (range.dateFrom !== undefined) {
                newFilters.dateFrom = range.dateFrom
              } else {
                delete newFilters.dateFrom
              }
              if (range.dateTo !== undefined) {
                newFilters.dateTo = range.dateTo
              } else {
                delete newFilters.dateTo
              }
              onFiltersChange(newFilters)
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <Clock className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Time</SelectItem>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
            <SelectItem value="1year">Last year</SelectItem>
            <SelectItem value="older1year">Older than 1 year</SelectItem>
            <SelectItem value="older2years">Older than 2 years</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>

        {/* Start Date */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'flex-1 flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50 px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-[color,box-shadow]',
                !filters.dateFrom && 'text-muted-foreground'
              )}
            >
              <span className="flex items-center">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                {filters.dateFrom ? format(new Date(filters.dateFrom), 'PP') : 'Start date'}
              </span>
              {filters.dateFrom && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateFilter('dateFrom', undefined)
                  }}
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
              captionLayout="dropdown"
              onSelect={(date) => {
                if (date) {
                  date.setHours(0, 0, 0, 0)
                  updateFilter('dateFrom', date.getTime())
                }
              }}
            />
          </PopoverContent>
        </Popover>

        {/* End Date */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'flex-1 flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50 px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-[color,box-shadow]',
                !filters.dateTo && 'text-muted-foreground'
              )}
            >
              <span className="flex items-center">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                {filters.dateTo ? format(new Date(filters.dateTo), 'PP') : 'End date'}
              </span>
              {filters.dateTo && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateFilter('dateTo', undefined)
                  }}
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
              captionLayout="dropdown"
              onSelect={(date) => {
                if (date) {
                  date.setHours(23, 59, 59, 999)
                  updateFilter('dateTo', date.getTime())
                }
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Select
          value={`${filters.sortBy || 'count'}-${filters.sortOrder || 'desc'}`}
          onValueChange={(v) => {
            const [sortBy, sortOrder] = v.split('-') as [
              SubscriptionFilters['sortBy'],
              'asc' | 'desc',
            ]
            onFiltersChange({ ...filters, sortBy, sortOrder })
          }}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count-desc">Most Emails</SelectItem>
            <SelectItem value="count-asc">Fewest Emails</SelectItem>
            <SelectItem value="size-desc">Largest Size</SelectItem>
            <SelectItem value="size-asc">Smallest Size</SelectItem>
            <SelectItem value="first_date-desc">Newest First Email</SelectItem>
            <SelectItem value="first_date-asc">Oldest First Email</SelectItem>
            <SelectItem value="latest_date-desc">Recent Activity</SelectItem>
            <SelectItem value="latest_date-asc">Oldest Activity</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function SubscriptionsPage({
  accountId,
  syncStatus,
  syncStartedAt,
  syncCompletedAt,
  onSyncComplete,
}: SubscriptionsPageProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  const { syncProgress, syncLoading, resumeSync, isSyncing } = useAppContext()

  // Initialize filters from URL on mount
  const getInitialFilters = useCallback((): SubscriptionFilters => {
    const searchParams = new URLSearchParams(location.search)
    if (searchParams.toString()) {
      return searchParamsToSubscriptionFilters(searchParams)
    }
    return {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run once on mount
  }, [])

  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<SubscriptionFilters>(getInitialFilters)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [isBulkUnsubscribing, setIsBulkUnsubscribing] = useState(false)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const limit = 50

  // Update URL when filters change
  const setFilters = useCallback(
    (newFilters: SubscriptionFilters) => {
      setFiltersState(newFilters)
      const params = subscriptionFiltersToSearchParams(newFilters)
      navigate({
        to: '.',
        search: params.toString() ? Object.fromEntries(params) : {},
        replace: true,
      })
    },
    [navigate]
  )

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.subscriptions(accountId, page, filters),
    queryFn: () => getSubscriptions(accountId, page, limit, filters),
    enabled: !!accountId,
  })

  const subscriptions = useMemo(() => data?.subscriptions ?? [], [data?.subscriptions])
  const pagination = data?.pagination

  // Get selectable subscriptions (not already unsubscribed)
  const selectableSubscriptions = useMemo(
    () => subscriptions.filter((s) => !s.isUnsubscribed),
    [subscriptions]
  )

  // Check if all selectable items on current page are selected
  const allSelected = useMemo(
    () =>
      selectableSubscriptions.length > 0 &&
      selectableSubscriptions.every((s) => selectedEmails.has(s.email)),
    [selectableSubscriptions, selectedEmails]
  )

  // Check if some items are selected
  const someSelected = useMemo(
    () => selectableSubscriptions.some((s) => selectedEmails.has(s.email)),
    [selectableSubscriptions, selectedEmails]
  )

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const newSelected = new Set(selectedEmails)
        selectableSubscriptions.forEach((s) => newSelected.add(s.email))
        setSelectedEmails(newSelected)
      } else {
        const newSelected = new Set(selectedEmails)
        selectableSubscriptions.forEach((s) => newSelected.delete(s.email))
        setSelectedEmails(newSelected)
      }
    },
    [selectableSubscriptions, selectedEmails]
  )

  const handleSelectOne = useCallback(
    (email: string, checked: boolean) => {
      const newSelected = new Set(selectedEmails)
      if (checked) {
        newSelected.add(email)
      } else {
        newSelected.delete(email)
      }
      setSelectedEmails(newSelected)
    },
    [selectedEmails]
  )

  const handleUnsubscribeClick = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setDialogOpen(true)
  }

  const handleSyncComplete = () => {
    refetch()
    onSyncComplete?.()
  }

  const handleFiltersChange = useCallback(
    (newFilters: SubscriptionFilters) => {
      setFilters(newFilters)
      setPage(1) // Reset to first page when filters change
      setSelectedEmails(new Set()) // Clear selection when filters change
    },
    [setFilters]
  )

  const handleBulkMarkUnsubscribed = useCallback(async () => {
    if (selectedEmails.size === 0) return

    const selectedSenders = subscriptions
      .filter((s) => selectedEmails.has(s.email))
      .map((s) => ({ email: s.email, name: s.name }))

    setIsBulkUnsubscribing(true)
    try {
      const result = await bulkMarkAsUnsubscribed(accountId, selectedSenders)
      toast.success(result.message)
      setSelectedEmails(new Set())
      setBulkConfirmOpen(false)
      // Invalidate subscriptions query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['subscriptions', accountId] })
    } catch (err) {
      toast.error(t('toast.bulkUnsubscribe.error'))
      console.error(err)
    } finally {
      setIsBulkUnsubscribing(false)
    }
  }, [accountId, selectedEmails, subscriptions, queryClient, t])

  const isSyncPending = syncStatus !== 'completed'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('subscriptions.title')}</h1>
          <p className="text-muted-foreground">{t('subscriptions.description')}</p>
        </div>
        {!isSyncing && (
          <SyncStatusBar
            accountId={accountId}
            syncStartedAt={syncStartedAt ?? null}
            syncCompletedAt={syncCompletedAt ?? null}
            syncStatus={syncStatus}
            onSyncComplete={handleSyncComplete}
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
      <SubscriptionFiltersUI
        filters={filters}
        onFiltersChange={handleFiltersChange}
        disabled={isLoading || isSyncPending}
      />

      {/* Bulk Actions & Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedEmails.size > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBulkConfirmOpen(true)}
              disabled={isBulkUnsubscribing}
            >
              {isBulkUnsubscribing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckSquare className="h-4 w-4 mr-2" />
              )}
              {t('subscriptions.markUnsubscribed')} {selectedEmails.size.toLocaleString()}
            </Button>
          )}
        </div>

        {pagination && (
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, pagination.total)} of{' '}
              {pagination.total.toLocaleString()} subscriptions
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(1)}
                disabled={page === 1 || isLoading}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-3 text-sm">
                Page {page} of {pagination.totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages || isLoading}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(pagination.totalPages)}
                disabled={page >= pagination.totalPages || isLoading}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isSyncPending ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">{t('subscriptions.syncPending.title')}</h3>
            <p className="text-muted-foreground text-center max-w-sm mx-auto">
              {t('subscriptions.syncPending.description')}
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <MailMinus className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load subscriptions: {error.message}</p>
          </div>
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center">
            <MailMinus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">{t('subscriptions.noResults')}</p>
            <p className="text-sm text-muted-foreground/70">
              {t('subscriptions.noResults.description')}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected || (someSelected && 'indeterminate')}
                    onCheckedChange={handleSelectAll}
                    disabled={selectableSubscriptions.length === 0}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-[28%]">From</TableHead>
                <TableHead className="w-[10%] text-center">Emails</TableHead>
                <TableHead className="w-[10%] text-center">Size</TableHead>
                <TableHead className="w-[13%] text-center">First Email</TableHead>
                <TableHead className="w-[13%] text-center">Last Email</TableHead>
                <TableHead className="w-[18%] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((subscription) => (
                <SubscriptionRow
                  key={subscription.email}
                  subscription={subscription}
                  isSelected={selectedEmails.has(subscription.email)}
                  onSelectChange={(checked) => handleSelectOne(subscription.email, checked)}
                  onUnsubscribeClick={handleUnsubscribeClick}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Unsubscribe Confirmation Dialog */}
      <UnsubscribeConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscription={selectedSubscription}
        accountId={accountId}
      />

      {/* Bulk Mark Unsubscribed Confirmation */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('subscriptions.bulk.confirmTitle').replace('{count}', String(selectedEmails.size))}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('subscriptions.bulk.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkMarkUnsubscribed} disabled={isBulkUnsubscribing}>
              {isBulkUnsubscribing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckSquare className="h-4 w-4 mr-2" />
              )}
              {t('subscriptions.bulk.markAsUnsubscribed')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
