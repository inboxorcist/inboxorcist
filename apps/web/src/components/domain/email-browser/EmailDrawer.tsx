import { useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, Loader2, Paperclip, Mail, AlertTriangle, Calendar, User } from 'lucide-react'
import { Drawer, DrawerContent, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getEmailContent, markEmailAsRead, type EmailRecord } from '@/lib/api'

interface EmailDrawerProps {
  accountId: string
  email: EmailRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEmailRead?: (messageId: string) => void
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

// Parse email address from header
function parseEmailHeader(header: string | null): { name: string | null; email: string } {
  if (!header) return { name: null, email: 'unknown' }

  const match = header.match(/"?([^"<]*)"?\s*<?([^\s<>]+@[^\s<>]+)>?/)
  if (match) {
    const name = match[1]?.trim() || null
    const email = match[2] || header
    return { name, email }
  }

  return { name: null, email: header }
}

export function EmailDrawer({
  accountId,
  email,
  open,
  onOpenChange,
  onEmailRead,
}: EmailDrawerProps) {
  const markedAsReadRef = useRef<string | null>(null)

  // Fetch full email content when drawer opens
  const {
    data: emailContent,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['email-content', accountId, email?.message_id],
    queryFn: () => getEmailContent(accountId, email!.message_id),
    enabled: open && !!email?.message_id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Mutation to mark email as read
  const markAsReadMutation = useMutation({
    mutationFn: () => markEmailAsRead(accountId, email!.message_id),
    onSuccess: () => {
      // Notify parent to update just this email's read status
      onEmailRead?.(email!.message_id)
    },
  })

  // Mark as read when opening an unread email
  useEffect(() => {
    if (open && email && email.is_unread === 1 && markedAsReadRef.current !== email.message_id) {
      markedAsReadRef.current = email.message_id
      markAsReadMutation.mutate()
    }
    // Reset ref when drawer closes
    if (!open) {
      markedAsReadRef.current = null
    }
  }, [open, email, markAsReadMutation])

  const from = emailContent ? parseEmailHeader(emailContent.headers.from) : null
  const to = emailContent?.headers.to
  const subject = emailContent?.headers.subject || email?.subject || '(No subject)'
  const date = formatDate(emailContent?.headers.date || null)

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[55vw] min-w-[600px] ml-auto rounded-l-lg flex flex-col outline-none focus:outline-none">
        {/* Compact Header */}
        <div className="shrink-0 border-b bg-card">
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="text-base font-semibold truncate pr-4 flex-1">{subject}</h2>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>

          {/* Metadata bar */}
          {emailContent && (
            <div className="px-5 pb-3 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{from?.name || from?.email}</span>
                {from?.name && <span className="text-xs">&lt;{from.email}&gt;</span>}
              </div>
              {to && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">to</span>
                  <span className="truncate max-w-[200px]">{to.split('<')[0].trim()}</span>
                </div>
              )}
              {date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{date}</span>
                </div>
              )}
              {emailContent.sizeEstimate && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {formatBytes(emailContent.sizeEstimate)}
                </Badge>
              )}
            </div>
          )}

          {/* Attachments */}
          {emailContent && emailContent.attachments.length > 0 && (
            <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              {emailContent.attachments.map((attachment, i) => (
                <Badge key={i} variant="outline" className="text-xs gap-1 px-2 py-0.5">
                  <span className="max-w-[150px] truncate">{attachment.filename}</span>
                  <span className="text-muted-foreground">({formatBytes(attachment.size)})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Email Body - takes remaining space */}
        <div className="flex-1 min-h-0 bg-background">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Failed to load email content. Please try again.
              </p>
            </div>
          ) : emailContent ? (
            emailContent.body.html ? (
              <iframe
                srcDoc={emailContent.body.html}
                title="Email content"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
                style={{ colorScheme: 'light', background: 'white' }}
              />
            ) : emailContent.body.text ? (
              <div className="h-full overflow-auto p-5">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {emailContent.body.text}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Mail className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No content available</p>
              </div>
            )
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
