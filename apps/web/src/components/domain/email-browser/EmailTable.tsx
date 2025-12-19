/* eslint-disable react-refresh/only-export-components -- formatBytes utility is intentionally exported alongside EmailTable for use by other components */
import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type RowSelectionState,
  type ColumnSizingState,
  type OnChangeFn,
} from '@tanstack/react-table'
import type { EmailRecord } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Mail,
  Paperclip,
  Star,
  AlertOctagon,
  Trash2,
  ChevronsUp,
  MailMinus,
} from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface EmailTableProps {
  emails: EmailRecord[]
  isLoading: boolean
  error: string | null
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  columnSizing: ColumnSizingState
  onColumnSizingChange: OnChangeFn<ColumnSizingState>
  isSyncPending?: boolean
  hasActiveFilters?: boolean
  onClearFilters?: () => void
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Format date to human readable
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

// Get category display name and color
function getCategoryInfo(category: string | null): { label: string; color: string } {
  const categoryMap: Record<string, { label: string; color: string }> = {
    CATEGORY_PROMOTIONS: {
      label: 'Promotions',
      color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    },
    CATEGORY_SOCIAL: { label: 'Social', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
    CATEGORY_UPDATES: {
      label: 'Updates',
      color: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
    },
    CATEGORY_FORUMS: {
      label: 'Forums',
      color: 'bg-green-500/20 text-green-700 dark:text-green-400',
    },
    CATEGORY_PERSONAL: {
      label: 'Primary',
      color: 'bg-gray-500/20 text-gray-700 dark:text-gray-400',
    },
    SENT: { label: 'Sent', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
    SPAM: { label: 'Spam', color: 'bg-red-500/20 text-red-700 dark:text-red-400' },
    TRASH: { label: 'Trash', color: 'bg-orange-500/20 text-orange-700 dark:text-orange-400' },
  }

  if (!category) return { label: 'Other', color: 'bg-gray-500/20 text-gray-600 dark:text-gray-400' }
  return (
    categoryMap[category] || {
      label: category.replace('CATEGORY_', ''),
      color: 'bg-gray-500/20 text-gray-600',
    }
  )
}

const columnHelper = createColumnHelper<EmailRecord>()

export function EmailTable({
  emails,
  isLoading,
  error,
  rowSelection,
  onRowSelectionChange,
  columnSizing,
  onColumnSizingChange,
  isSyncPending = false,
  hasActiveFilters = false,
  onClearFilters,
}: EmailTableProps) {
  const { t } = useLanguage()

  // Define columns
  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }: { table: ReturnType<typeof useReactTable<EmailRecord>> }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({
          row,
        }: {
          row: { getIsSelected: () => boolean; toggleSelected: (value: boolean) => void }
        }) => (
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
      columnHelper.accessor('from_email', {
        header: 'From',
        cell: ({ row }) => {
          const email = row.original
          return (
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden">
                <p
                  className={`truncate text-sm ${email.is_unread === 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                >
                  {email.from_name || email.from_email}
                </p>
                <p className="text-xs text-muted-foreground truncate">{email.from_email}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {email.is_spam === 1 && (
                  <span title="Spam">
                    <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
                  </span>
                )}
                {email.is_trash === 1 && (
                  <span title="Trash">
                    <Trash2 className="h-3.5 w-3.5 text-orange-500" />
                  </span>
                )}
                {email.is_important === 1 && (
                  <span title="Important">
                    <ChevronsUp className="h-3.5 w-3.5 text-amber-500" />
                  </span>
                )}
                {email.is_starred === 1 && (
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                )}
                {email.has_attachments === 1 && (
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
          )
        },
        size: 200,
        minSize: 100,
        maxSize: 320,
      }),
      columnHelper.accessor('subject', {
        header: 'Subject',
        cell: ({ row }) => {
          const email = row.original
          return (
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-2">
                <p
                  className={`truncate text-sm ${email.is_unread === 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                >
                  {email.subject || '(No subject)'}
                </p>
                {email.unsubscribe_link && (
                  <a
                    href={email.unsubscribe_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    <Badge
                      variant="secondary"
                      className="text-xs px-1.5 py-0 h-5 gap-1 hover:bg-muted cursor-pointer"
                    >
                      <MailMinus className="h-3 w-3" />
                      Unsub
                    </Badge>
                  </a>
                )}
              </div>
              {email.snippet && (
                <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
              )}
            </div>
          )
        },
        // Subject takes remaining space - no fixed size
        minSize: 150,
        maxSize: 9999,
        enableResizing: false,
      }),
      columnHelper.accessor('category', {
        header: 'Category',
        cell: ({ getValue }) => {
          const categoryInfo = getCategoryInfo(getValue())
          return (
            <Badge
              variant="secondary"
              className={`text-xs whitespace-nowrap ${categoryInfo.color}`}
            >
              {categoryInfo.label}
            </Badge>
          )
        },
        size: 110,
        minSize: 80,
        maxSize: 140,
      }),
      columnHelper.accessor('size_bytes', {
        header: 'Size',
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatBytes(getValue())}
          </span>
        ),
        size: 70,
        minSize: 50,
        maxSize: 100,
      }),
      columnHelper.accessor('internal_date', {
        header: () => <div className="text-right">Date</div>,
        cell: ({ getValue }) => (
          <div className="text-sm text-muted-foreground text-right whitespace-nowrap">
            {formatDate(getValue())}
          </div>
        ),
        size: 100,
        minSize: 70,
        maxSize: 130,
      }),
    ],
    []
  )

  // Create table instance
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API is designed this way; memoization handled internally
  const table = useReactTable({
    data: emails,
    columns,
    state: {
      rowSelection,
      columnSizing,
    },
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onRowSelectionChange: onRowSelectionChange,
    onColumnSizingChange: onColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.message_id,
  })

  const { rows } = table.getRowModel()

  return (
    <div className="rounded-lg border bg-card">
      {error && error !== 'Sync not complete' ? (
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
              <h3 className="text-lg font-medium mb-2">{t('explorer.syncPending.title')}</h3>
              <p className="text-muted-foreground text-center max-w-sm mx-auto">
                {t('explorer.syncPending.description')}
              </p>
            </>
          ) : (
            <>
              <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">{t('explorer.noEmails')}</p>
              <p className="text-sm text-muted-foreground/70">
                {t('explorer.noEmails.description')}
              </p>
              {hasActiveFilters && onClearFilters && (
                <Button variant="link" onClick={onClearFilters} className="mt-2">
                  {t('explorer.clearAll')}
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
                  const canResize = header.column.getCanResize()
                  const isFlexColumn = header.column.id === 'subject'
                  return (
                    <TableHead
                      key={header.id}
                      style={isFlexColumn ? undefined : { width: header.getSize() }}
                      className={`relative group ${isFlexColumn ? 'w-auto' : ''}`}
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
                            header.column.getIsResizing() ? 'bg-primary' : ''
                          }`}
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                {row.getVisibleCells().map((cell) => {
                  const isFlexColumn = cell.column.id === 'subject'
                  return (
                    <TableCell
                      key={cell.id}
                      style={isFlexColumn ? undefined : { width: cell.column.getSize() }}
                      className={`overflow-hidden ${isFlexColumn ? 'w-auto' : ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export { formatBytes }
