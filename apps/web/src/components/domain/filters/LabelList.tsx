import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tags,
  AlertCircle,
  Loader2,
  Inbox,
  Send,
  Star,
  FileText,
  Trash2,
  AlertTriangle,
  MessageSquare,
  Tag,
  ShoppingBag,
  Users,
  Bell,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
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
import { getLabels, deleteLabel, type GmailLabel } from '@/lib/api'
import { LabelCard } from './LabelCard'
import { LabelFormDialog } from './LabelFormDialog'
import { useLanguage } from '@/hooks/useLanguage'

interface LabelListProps {
  accountId: string
  showCreateDialog: boolean
  onCreateDialogChange: (open: boolean) => void
}

// Format system label names: INBOX -> Inbox, CATEGORY_PROMOTIONS -> Promotions
function formatLabelName(name: string): string {
  // Handle category labels
  if (name.startsWith('CATEGORY_')) {
    const category = name.replace('CATEGORY_', '')
    return category.charAt(0) + category.slice(1).toLowerCase()
  }
  // Handle regular system labels
  return name.charAt(0) + name.slice(1).toLowerCase()
}

// Get icon for system label
function getSystemLabelIcon(id: string) {
  const iconMap: Record<string, React.ReactNode> = {
    INBOX: <Inbox className="h-4 w-4" />,
    SENT: <Send className="h-4 w-4" />,
    STARRED: <Star className="h-4 w-4" />,
    DRAFT: <FileText className="h-4 w-4" />,
    TRASH: <Trash2 className="h-4 w-4" />,
    SPAM: <AlertTriangle className="h-4 w-4" />,
    IMPORTANT: <AlertCircle className="h-4 w-4" />,
    CHAT: <MessageSquare className="h-4 w-4" />,
    CATEGORY_PERSONAL: <Users className="h-4 w-4" />,
    CATEGORY_SOCIAL: <Users className="h-4 w-4" />,
    CATEGORY_PROMOTIONS: <ShoppingBag className="h-4 w-4" />,
    CATEGORY_UPDATES: <Bell className="h-4 w-4" />,
    CATEGORY_FORUMS: <MessageSquare className="h-4 w-4" />,
    UNREAD: <Clock className="h-4 w-4" />,
  }
  return iconMap[id] || <Tag className="h-4 w-4" />
}

// Labels to show in system section (filter out internal ones)
const VISIBLE_SYSTEM_LABELS = [
  'INBOX',
  'SENT',
  'STARRED',
  'DRAFT',
  'TRASH',
  'SPAM',
  'IMPORTANT',
  'CHAT',
  'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
]

export function LabelList({ accountId, showCreateDialog, onCreateDialogChange }: LabelListProps) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  // State for dialogs
  const [labelToDelete, setLabelToDelete] = useState<GmailLabel | null>(null)
  const [labelToEdit, setLabelToEdit] = useState<GmailLabel | null>(null)

  // Fetch labels
  const { data, isLoading, error } = useQuery({
    queryKey: ['labels', accountId],
    queryFn: () => getLabels(accountId),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (labelId: string) => deleteLabel(accountId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', accountId] })
      toast.success(t('labels.deleted'))
      setLabelToDelete(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('labels.error.delete'))
    },
  })

  // Sync create dialog state with parent
  /* eslint-disable react-hooks/set-state-in-effect -- State sync with parent is a valid pattern */
  useEffect(() => {
    if (!showCreateDialog) {
      setLabelToEdit(null)
    }
  }, [showCreateDialog])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handlers
  const handleEdit = (label: GmailLabel) => {
    setLabelToEdit(label)
    onCreateDialogChange(true)
  }

  const handleDelete = (label: GmailLabel) => {
    setLabelToDelete(label)
  }

  const confirmDelete = () => {
    if (labelToDelete) {
      deleteMutation.mutate(labelToDelete.id)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('labels.error.load')}</AlertDescription>
      </Alert>
    )
  }

  const systemLabels = (data?.systemLabels || []).filter((l) =>
    VISIBLE_SYSTEM_LABELS.includes(l.id)
  )
  const userLabels = data?.userLabels || []

  return (
    <>
      <div className="space-y-8">
        {/* User Labels */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            {t('labels.section.user')}
          </h3>
          {userLabels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
              <div className="rounded-full bg-primary/10 p-3 mb-3">
                <Tags className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{t('labels.empty.user')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {userLabels.map((label) => (
                <LabelCard
                  key={label.id}
                  label={label}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* System Labels */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            {t('labels.section.system')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {systemLabels.map((label) => (
              <div
                key={label.id}
                className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-transparent"
              >
                <span className="text-muted-foreground">{getSystemLabelIcon(label.id)}</span>
                <span className="text-sm font-medium">{formatLabelName(label.name)}</span>
                {label.messagesTotal !== undefined && label.messagesTotal > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {label.messagesTotal.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!labelToDelete} onOpenChange={() => setLabelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('labels.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('labels.delete.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          {labelToDelete && (
            <div className="my-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full border"
                  style={{
                    backgroundColor: labelToDelete.color?.backgroundColor || '#e0e0e0',
                    borderColor: labelToDelete.color?.textColor || '#ccc',
                  }}
                />
                <span className="font-medium">{labelToDelete.name}</span>
                {labelToDelete.messagesTotal !== undefined && labelToDelete.messagesTotal > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({labelToDelete.messagesTotal.toLocaleString()} messages)
                  </span>
                )}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.deleting')}
                </>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Label Dialog */}
      <LabelFormDialog
        accountId={accountId}
        open={showCreateDialog}
        onOpenChange={onCreateDialogChange}
        editLabel={labelToEdit}
      />
    </>
  )
}
