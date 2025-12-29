import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { RowSelectionState, ColumnSizingState } from '@tanstack/react-table'
import {
  getExplorerEmailsByQueryId,
  getLabels,
  type EmailRecord,
  type GmailLabel,
  type ExplorerFilters,
} from '@/lib/api'
import { EmailTable } from '@/components/domain/email-browser/EmailTable'
import { EmailPagination } from '@/components/domain/email-browser/EmailPagination'
import { EmailDrawer } from '@/components/domain/email-browser/EmailDrawer'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  HardDrive,
  Loader2,
  Mail,
  Paperclip,
  Tag,
  User,
} from 'lucide-react'

interface EmailTableEmbedProps {
  accountId: string
  queryId: string
  title?: string
}

const PAGE_SIZE = 50

// Format date for display
function formatFilterDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_UPDATES: 'Updates',
  CATEGORY_FORUMS: 'Forums',
  CATEGORY_PERSONAL: 'Primary',
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Build filter badges from filters object
function FilterBadges({ filters }: { filters: ExplorerFilters }) {
  const badges: { label: string; value: string; icon?: React.ReactNode }[] = []

  // Sender filters
  if (filters.sender) {
    badges.push({ label: 'Sender', value: filters.sender, icon: <User className="h-3 w-3" /> })
  }
  if (filters.senderEmail) {
    const emails = filters.senderEmail.split(',')
    badges.push({
      label: 'From',
      value: emails.length > 1 ? `${emails.length} senders` : emails[0],
      icon: <Mail className="h-3 w-3" />,
    })
  }
  if (filters.senderDomain) {
    const domains = filters.senderDomain.split(',')
    badges.push({
      label: 'Domain',
      value: domains.length > 1 ? `${domains.length} domains` : `@${domains[0]}`,
    })
  }

  // Category
  if (filters.category) {
    badges.push({
      label: 'Category',
      value: CATEGORY_NAMES[filters.category] || filters.category,
      icon: <Tag className="h-3 w-3" />,
    })
  }

  // Date filters
  if (filters.dateFrom || filters.dateTo) {
    let dateStr = ''
    if (filters.dateFrom && filters.dateTo) {
      dateStr = `${formatFilterDate(filters.dateFrom)} - ${formatFilterDate(filters.dateTo)}`
    } else if (filters.dateFrom) {
      dateStr = `After ${formatFilterDate(filters.dateFrom)}`
    } else if (filters.dateTo) {
      dateStr = `Before ${formatFilterDate(filters.dateTo)}`
    }
    badges.push({ label: 'Date', value: dateStr, icon: <Calendar className="h-3 w-3" /> })
  }

  // Size filters
  if (filters.sizeMin !== undefined || filters.sizeMax !== undefined) {
    let sizeStr = ''
    if (filters.sizeMin !== undefined && filters.sizeMax !== undefined) {
      sizeStr = `${formatBytes(filters.sizeMin)} - ${formatBytes(filters.sizeMax)}`
    } else if (filters.sizeMin !== undefined) {
      sizeStr = `> ${formatBytes(filters.sizeMin)}`
    } else if (filters.sizeMax !== undefined) {
      sizeStr = `< ${formatBytes(filters.sizeMax)}`
    }
    badges.push({ label: 'Size', value: sizeStr, icon: <HardDrive className="h-3 w-3" /> })
  }

  // Boolean filters - show both true and false values
  if (filters.isUnread === true) {
    badges.push({ label: 'Status', value: 'Unread' })
  } else if (filters.isUnread === false) {
    badges.push({ label: 'Status', value: 'Read' })
  }

  if (filters.isStarred === true) {
    badges.push({ label: 'Starred', value: 'Yes' })
  } else if (filters.isStarred === false) {
    badges.push({ label: 'Starred', value: 'No' })
  }

  if (filters.isImportant === true) {
    badges.push({ label: 'Important', value: 'Yes' })
  } else if (filters.isImportant === false) {
    badges.push({ label: 'Important', value: 'No' })
  }

  if (filters.isTrash === true) {
    badges.push({ label: 'Trash', value: 'Yes' })
  } else if (filters.isTrash === false) {
    badges.push({ label: 'Trash', value: 'No' })
  }

  if (filters.isSpam === true) {
    badges.push({ label: 'Spam', value: 'Yes' })
  } else if (filters.isSpam === false) {
    badges.push({ label: 'Spam', value: 'No' })
  }

  if (filters.isSent === true) {
    badges.push({ label: 'Sent', value: 'Yes' })
  } else if (filters.isSent === false) {
    badges.push({ label: 'Sent', value: 'No' })
  }

  if (filters.isArchived === true) {
    badges.push({ label: 'Archived', value: 'Yes' })
  } else if (filters.isArchived === false) {
    badges.push({ label: 'Archived', value: 'No' })
  }

  if (filters.hasAttachments === true) {
    badges.push({ label: 'Attachments', value: 'Yes', icon: <Paperclip className="h-3 w-3" /> })
  } else if (filters.hasAttachments === false) {
    badges.push({ label: 'Attachments', value: 'No', icon: <Paperclip className="h-3 w-3" /> })
  }

  // Label IDs
  if (filters.labelIds) {
    const labelCount = filters.labelIds.split(',').length
    badges.push({
      label: 'Labels',
      value: labelCount > 1 ? `${labelCount} labels` : filters.labelIds,
      icon: <Tag className="h-3 w-3" />,
    })
  }

  // Search query
  if (filters.search) {
    badges.push({ label: 'Search', value: filters.search })
  }

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge, idx) => (
        <Badge key={idx} variant="secondary" className="gap-1.5 font-normal">
          {badge.icon}
          <span className="text-muted-foreground">{badge.label}:</span>
          <span>{badge.value}</span>
        </Badge>
      ))}
    </div>
  )
}

export function EmailTableEmbed({ accountId, queryId, title }: EmailTableEmbedProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null)
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false)

  // Empty selection state (read-only, no selection in chat)
  const [rowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})

  // Fetch emails by queryId - only when drawer is open
  const {
    data: emailsData,
    isLoading: emailsLoading,
    error: emailsError,
  } = useQuery({
    queryKey: ['chat-emails', accountId, queryId, page, PAGE_SIZE],
    queryFn: () => getExplorerEmailsByQueryId(accountId, queryId, page, PAGE_SIZE),
    staleTime: 60 * 1000, // 1 minute cache
    enabled: drawerOpen, // Only fetch when drawer is open
  })

  // Fetch labels for display - only when drawer is open
  const { data: labelsData } = useQuery({
    queryKey: ['labels', accountId],
    queryFn: () => getLabels(accountId),
    staleTime: 5 * 60 * 1000, // 5 minute cache
    enabled: drawerOpen,
  })

  // Create labels map for quick lookup
  const labelsMap = useMemo(() => {
    if (!labelsData) return new Map<string, GmailLabel>()
    const map = new Map<string, GmailLabel>()
    labelsData.labels.forEach((label) => map.set(label.id, label))
    return map
  }, [labelsData])

  // Handle row click - open email preview
  const handleRowClick = (email: EmailRecord) => {
    setSelectedEmail(email)
    setEmailPreviewOpen(true)
  }

  // Handle email marked as read - update local state
  const handleEmailRead = (_messageId: string) => {
    // read only table, no action needed
  }

  const emails = emailsData?.emails || []
  const pagination = emailsData?.pagination || null
  const filters = emailsData?.filters || null

  return (
    <>
      {/* Preview emails button */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="group inline-flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-border transition-all"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-foreground/10">
          <Mail className="h-4 w-4 text-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground">{title || 'Preview emails'}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* Email table drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="w-full sm:max-w-4xl h-full max-h-screen">
          <DrawerHeader className="border-b shrink-0">
            <DrawerTitle>{title || 'Email Preview'}</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-auto p-6">
            {/* Loading state */}
            {emailsLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Error state */}
            {emailsError && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  {emailsError instanceof Error ? emailsError.message : 'Failed to load emails'}
                </p>
              </div>
            )}

            {/* Email table */}
            {!emailsLoading && !emailsError && (
              <div className="space-y-4">
                {/* Applied filters */}
                {filters && <FilterBadges filters={filters} />}

                {/* Pagination - above table, aligned right */}
                {pagination && pagination.total > 0 && (
                  <div className="flex justify-end">
                    <EmailPagination
                      pagination={pagination}
                      page={page}
                      onPageChange={setPage}
                      isLoading={emailsLoading}
                    />
                  </div>
                )}

                {/* Table */}
                <EmailTable
                  emails={emails}
                  isLoading={false}
                  error={null}
                  rowSelection={rowSelection}
                  onRowSelectionChange={() => {}} // No-op, selection disabled
                  columnSizing={columnSizing}
                  onColumnSizingChange={setColumnSizing}
                  labelsMap={labelsMap}
                  onRowClick={handleRowClick}
                  hideSelection
                />
              </div>
            )}
          </div>

          {/* Email preview drawer (nested) */}
          <EmailDrawer
            accountId={accountId}
            email={selectedEmail}
            open={emailPreviewOpen}
            onOpenChange={setEmailPreviewOpen}
            onEmailRead={handleEmailRead}
          />
        </DrawerContent>
      </Drawer>
    </>
  )
}
