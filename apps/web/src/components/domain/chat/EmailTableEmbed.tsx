import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { RowSelectionState, ColumnSizingState } from '@tanstack/react-table'
import { getExplorerEmailsByQueryId, getLabels, type EmailRecord, type GmailLabel } from '@/lib/api'
import { EmailTable } from '@/components/domain/email-browser/EmailTable'
import { EmailPagination } from '@/components/domain/email-browser/EmailPagination'
import { EmailDrawer } from '@/components/domain/email-browser/EmailDrawer'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface EmailTableEmbedProps {
  accountId: string
  queryId: string
}

export function EmailTableEmbed({ accountId, queryId }: EmailTableEmbedProps) {
  const [page, setPage] = useState(1)
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Empty selection state (read-only, no selection in chat)
  const [rowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})

  // Fetch emails by queryId
  const {
    data: emailsData,
    isLoading: emailsLoading,
    error: emailsError,
  } = useQuery({
    queryKey: ['chat-emails', accountId, queryId, page],
    queryFn: () => getExplorerEmailsByQueryId(accountId, queryId, page, 25),
    staleTime: 60 * 1000, // 1 minute cache
  })

  // Fetch labels for display
  const { data: labelsData } = useQuery({
    queryKey: ['labels', accountId],
    queryFn: () => getLabels(accountId),
    staleTime: 5 * 60 * 1000, // 5 minute cache
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
    setDrawerOpen(true)
  }

  // Handle email marked as read - update local state
  const handleEmailRead = (messageId: string) => {
    // We can't easily update the query cache here, but since this is embedded
    // and read-only, we just let the next fetch pick up the change
    console.log('Email marked as read:', messageId)
  }

  // Loading state
  if (emailsLoading) {
    return (
      <div className="rounded-lg border bg-card p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (emailsError) {
    return (
      <div className="rounded-lg border bg-card p-8 flex flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {emailsError instanceof Error ? emailsError.message : 'Failed to load emails'}
        </p>
      </div>
    )
  }

  const emails = emailsData?.emails || []
  const pagination = emailsData?.pagination || null

  return (
    <div className="space-y-4">
      {/* Email table without selection column */}
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
      />

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex justify-center">
          <EmailPagination
            pagination={pagination}
            page={page}
            onPageChange={setPage}
            isLoading={emailsLoading}
          />
        </div>
      )}

      {/* Email preview drawer */}
      <EmailDrawer
        accountId={accountId}
        email={selectedEmail}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEmailRead={handleEmailRead}
      />
    </div>
  )
}
