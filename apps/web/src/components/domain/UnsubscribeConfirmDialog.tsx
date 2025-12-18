import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Loader2, ExternalLink, MailMinus } from 'lucide-react'
import { markAsUnsubscribed, type Subscription } from '@/lib/api'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/hooks/useLanguage'

interface UnsubscribeConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: Subscription | null
  accountId: string
}

export function UnsubscribeConfirmDialog({
  open,
  onOpenChange,
  subscription,
  accountId,
}: UnsubscribeConfirmDialogProps) {
  const queryClient = useQueryClient()
  const [hasClickedLink, setHasClickedLink] = useState(false)
  const { t } = useLanguage()

  const markUnsubscribedMutation = useMutation({
    mutationFn: () => markAsUnsubscribed(accountId, subscription!.email, subscription!.name),
    onSuccess: (data) => {
      if (data.alreadyUnsubscribed) {
        toast.info(t('dialog.unsubscribe.toast.alreadyDone'))
      } else {
        toast.success(t('dialog.unsubscribe.toast.success'))
      }
      // Invalidate subscriptions query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['subscriptions', accountId] })
      onOpenChange(false)
      setHasClickedLink(false)
    },
    onError: (error) => {
      toast.error(t('dialog.unsubscribe.toast.error'), {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const handleOpenLink = () => {
    if (subscription?.unsubscribe_link) {
      window.open(subscription.unsubscribe_link, '_blank', 'noopener,noreferrer')
      setHasClickedLink(true)
    }
  }

  const handleConfirmUnsubscribed = () => {
    if (subscription) {
      markUnsubscribedMutation.mutate()
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setHasClickedLink(false)
  }

  if (!subscription) return null

  const senderDisplay = subscription.name || subscription.email

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailMinus className="h-5 w-5 text-orange-500" />
            {t('dialog.unsubscribe.title').replace('{sender}', senderDisplay)}
          </DialogTitle>
          <DialogDescription>{t('dialog.unsubscribe.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sender info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium text-sm">
              {subscription.name || t('dialog.unsubscribe.unknownSender')}
            </p>
            <p className="text-sm text-muted-foreground">{subscription.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('dialog.unsubscribe.emailCount').replace('{count}', String(subscription.count))}
            </p>
          </div>

          {/* Step 1: Open unsubscribe link */}
          <div className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                hasClickedLink ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
              }`}
            >
              {hasClickedLink ? <CheckCircle className="h-4 w-4" /> : '1'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{t('dialog.unsubscribe.step1.title')}</p>
              <p className="text-xs text-muted-foreground mb-2">
                {t('dialog.unsubscribe.step1.description')}
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenLink} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                {t('dialog.unsubscribe.step1.button')}
              </Button>
            </div>
          </div>

          {/* Step 2: Confirm unsubscription */}
          <div className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                hasClickedLink ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${!hasClickedLink ? 'text-muted-foreground' : ''}`}
              >
                {t('dialog.unsubscribe.step2.title')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('dialog.unsubscribe.step2.description')}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleClose} className="sm:flex-1">
            <XCircle className="h-4 w-4 mr-1.5" />
            {t('dialog.unsubscribe.cancel')}
          </Button>
          <Button
            onClick={handleConfirmUnsubscribed}
            disabled={!hasClickedLink || markUnsubscribedMutation.isPending}
            className="sm:flex-1 bg-green-600 hover:bg-green-700"
          >
            {markUnsubscribedMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1.5" />
            )}
            {t('dialog.unsubscribe.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
