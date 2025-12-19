import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import type { ExplorerFilters, SenderSuggestion } from '@/lib/api'
import { getExplorerSenders } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  X,
  Inbox,
  Tag,
  HardDrive,
  MailOpen,
  User,
  Star,
  Paperclip,
  ChevronsUp,
  ArrowUpDown,
  CalendarIcon,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'

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

// Detect which preset matches the current date filters
function detectDatePreset(dateFrom?: number, dateTo?: number): DatePreset {
  if (dateFrom === undefined && dateTo === undefined) {
    return 'any'
  }

  const tolerance = 60 * 60 * 1000 // 1 hour tolerance for matching

  // Check each preset
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

interface EmailFiltersProps {
  filters: ExplorerFilters
  onFiltersChange: (filters: ExplorerFilters) => void
  accountId: string
  syncStatus: string | null
  disabled?: boolean
}

export function EmailFilters({
  filters,
  onFiltersChange,
  accountId,
  syncStatus,
  disabled = false,
}: EmailFiltersProps) {
  const { t } = useLanguage()

  // Local state for search input (applied on button click or Enter)
  const [searchInput, setSearchInput] = useState(filters.search || '')

  // Sender multi-select state
  // Selected values are prefixed: "domain:" for domains, "email:" for emails
  const [selectedSenderValues, setSelectedSenderValues] = useState<string[]>([])
  const [senderSuggestions, setSenderSuggestions] = useState<SenderSuggestion[]>([])
  const [senderSearch, setSenderSearch] = useState('')
  const [isSendersLoading, setIsSendersLoading] = useState(false)

  // Convert suggestions to MultiSelect options with prefixed values
  const senderOptions: MultiSelectOption[] = useMemo(() => {
    return senderSuggestions.map((s) => ({
      value: `${s.type}:${s.value}`,
      label: s.label,
    }))
  }, [senderSuggestions])

  // Sync local state when filters change externally
  useEffect(() => {
    setSearchInput(filters.search || '')
    // Rebuild selected values from filters (supports multiple domains)
    const values: string[] = []
    if (filters.senderDomain) {
      filters.senderDomain
        .split(',')
        .map((d) => d.trim())
        .forEach((domain) => {
          values.push(`domain:${domain}`)
        })
    }
    if (filters.sender) {
      filters.sender
        .split(',')
        .map((s) => s.trim())
        .forEach((email) => {
          values.push(`email:${email}`)
        })
    }
    setSelectedSenderValues(values)
  }, [filters.search, filters.sender, filters.senderDomain])

  // Fetch sender suggestions for the dropdown
  useEffect(() => {
    if (syncStatus !== 'completed') return

    const fetchSenders = async () => {
      setIsSendersLoading(true)
      try {
        const { suggestions } = await getExplorerSenders(accountId, senderSearch, 50)
        setSenderSuggestions(suggestions)
      } catch (err) {
        console.error('Failed to fetch senders:', err)
      } finally {
        setIsSendersLoading(false)
      }
    }

    const debounce = setTimeout(fetchSenders, 300)
    return () => clearTimeout(debounce)
  }, [accountId, senderSearch, syncStatus])

  // Parse selected sender values into domain and email filters
  const parseSenderSelections = useCallback((values: string[]) => {
    const domains: string[] = []
    const emails: string[] = []
    for (const v of values) {
      if (v.startsWith('domain:')) {
        domains.push(v.slice(7))
      } else if (v.startsWith('email:')) {
        emails.push(v.slice(6))
      }
    }
    return { domains, emails }
  }, [])

  // Apply search filter
  const handleSearch = useCallback(() => {
    const { domains, emails } = parseSenderSelections(selectedSenderValues)
    onFiltersChange({
      ...filters,
      search: searchInput || undefined,
      // Support multiple domains (comma-separated)
      senderDomain: domains.length > 0 ? domains.join(',') : undefined,
      sender: emails.length > 0 ? emails.join(',') : undefined,
    })
  }, [filters, onFiltersChange, searchInput, selectedSenderValues, parseSenderSelections])

  // Handle Enter key on search
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    },
    [handleSearch]
  )

  // Clear all filters - reset to Inbox (default state)
  const clearFilters = useCallback(() => {
    onFiltersChange({ isTrash: false, isSpam: false })
    setSearchInput('')
    setSelectedSenderValues([])
  }, [onFiltersChange])

  // Update a single filter
  const updateFilter = useCallback(
    <K extends keyof ExplorerFilters>(key: K, value: ExplorerFilters[K] | undefined) => {
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

  // Check if any filters are active (beyond default Inbox state)
  // Note: isTrash: false and isSpam: false is Inbox (default), not an active filter
  const hasActiveFilters = useMemo(() => {
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
      filters.isTrash === true || // Only active if showing trash
      filters.isSpam === true || // Only active if showing spam
      filters.isArchived === true || // Only active if showing archived
      filters.isImportant !== undefined
    )
  }, [filters])

  return (
    <div className="space-y-3 p-4 bg-card rounded-lg border">
      {/* Search Row */}
      <div className="flex items-center gap-3">
        {/* Location/Mailbox */}
        <Select
          value={
            filters.isTrash === true
              ? 'trash'
              : filters.isSpam === true
                ? 'spam'
                : filters.isArchived === true
                  ? 'archived'
                  : filters.isTrash === false && filters.isSpam === false
                    ? 'inbox'
                    : 'all'
          }
          onValueChange={(v) => {
            if (v === 'all') {
              const newFilters = { ...filters }
              delete newFilters.isTrash
              delete newFilters.isSpam
              delete newFilters.isArchived
              onFiltersChange(newFilters)
            } else if (v === 'inbox') {
              const newFilters = { ...filters, isTrash: false, isSpam: false }
              delete newFilters.isArchived
              onFiltersChange(newFilters)
            } else if (v === 'archived') {
              const newFilters = { ...filters, isArchived: true }
              delete newFilters.isTrash
              delete newFilters.isSpam
              onFiltersChange(newFilters)
            } else if (v === 'spam') {
              const newFilters = { ...filters, isSpam: true }
              delete newFilters.isTrash
              delete newFilters.isArchived
              onFiltersChange(newFilters)
            } else if (v === 'trash') {
              const newFilters = { ...filters, isTrash: true }
              delete newFilters.isSpam
              delete newFilters.isArchived
              onFiltersChange(newFilters)
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-[140px]">
            <Inbox className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Mail</SelectItem>
            <SelectItem value="inbox">Inbox</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="spam">Spam</SelectItem>
            <SelectItem value="trash">Trash</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('explorer.searchSubject')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <MultiSelect
          options={senderOptions}
          selected={selectedSenderValues}
          onChange={setSelectedSenderValues}
          placeholder={t('explorer.filterBySender')}
          searchPlaceholder={t('explorer.searchSenders')}
          emptyMessage={isSendersLoading ? 'Loading...' : t('explorer.noSendersFound')}
          isLoading={isSendersLoading}
          onSearchChange={setSenderSearch}
          icon={<User className="h-4 w-4 text-muted-foreground" />}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={disabled}>
          <Search className="h-4 w-4 mr-2" />
          {t('explorer.search')}
        </Button>
        <Button
          variant="ghost"
          onClick={clearFilters}
          disabled={!hasActiveFilters || disabled}
          className="shrink-0"
        >
          <X className="h-4 w-4 mr-2" />
          {t('explorer.clearAll')}
        </Button>
      </div>

      {/* Filter Row - 5 items */}
      <div className="flex items-center gap-3">
        {/* Category */}
        <Select
          value={filters.category || 'all'}
          onValueChange={(v) => updateFilter('category', v === 'all' ? undefined : v)}
          disabled={disabled}
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
          value={filters.sizeMin ? String(filters.sizeMin) : 'all'}
          onValueChange={(v) => updateFilter('sizeMin', v === 'all' ? undefined : parseInt(v))}
          disabled={disabled}
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
          value={filters.isUnread === undefined ? 'all' : filters.isUnread ? 'unread' : 'read'}
          onValueChange={(v) => updateFilter('isUnread', v === 'all' ? undefined : v === 'unread')}
          disabled={disabled}
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
          value={
            filters.isStarred === undefined ? 'all' : filters.isStarred ? 'starred' : 'not-starred'
          }
          onValueChange={(v) =>
            updateFilter('isStarred', v === 'all' ? undefined : v === 'starred')
          }
          disabled={disabled}
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
          value={
            filters.isImportant === undefined
              ? 'all'
              : filters.isImportant
                ? 'important'
                : 'not-important'
          }
          onValueChange={(v) =>
            updateFilter('isImportant', v === 'all' ? undefined : v === 'important')
          }
          disabled={disabled}
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
      </div>

      {/* Date Range & Sort Row - 5 items */}
      <div className="flex items-center gap-3">
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
              // Don't change anything for custom - user uses date pickers
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
                  // Set to start of day
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
                  // Set to end of day
                  date.setHours(23, 59, 59, 999)
                  updateFilter('dateTo', date.getTime())
                }
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Attachments */}
        <Select
          value={
            filters.hasAttachments === undefined ? 'all' : filters.hasAttachments ? 'yes' : 'no'
          }
          onValueChange={(v) =>
            updateFilter('hasAttachments', v === 'all' ? undefined : v === 'yes')
          }
          disabled={disabled}
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

        {/* Sort */}
        <Select
          value={`${filters.sortBy || 'date'}-${filters.sortOrder || 'desc'}`}
          onValueChange={(v) => {
            const [sortBy, sortOrder] = v.split('-') as ['date' | 'size', 'asc' | 'desc']
            onFiltersChange({ ...filters, sortBy, sortOrder })
          }}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="size-desc">Largest First</SelectItem>
            <SelectItem value="size-asc">Smallest First</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
