import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  onConfirm: () => void
  isLoading?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isLoading = false,
}: DeleteConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const { t, isExorcistMode } = useLanguage()

  // For exorcist mode, use "banish X spirits" instead of "delete X emails"
  const plural = selectedCount > 1 ? 's' : ''
  const itemWord = isExorcistMode ? `spirit${plural}` : `email${plural}`
  const actionWord = isExorcistMode ? 'banish' : 'delete'
  const expectedText = `${actionWord} ${selectedCount} ${itemWord}`
  const isConfirmValid = confirmText.toLowerCase() === expectedText.toLowerCase()

  // Handle dialog open/close and reset text when closing
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('')
    }
    onOpenChange(newOpen)
  }

  const handleConfirm = () => {
    if (isConfirmValid) {
      onConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="text-left">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Trash2 className="h-7 w-7 text-destructive" />
          </div>
          <DialogTitle className="text-center text-xl">
            {t('dialog.delete.title')
              .replace('{count}', String(selectedCount))
              .replace('{plural}', plural)}
          </DialogTitle>
          <DialogDescription className="text-center space-y-3 pt-2">
            <p
              dangerouslySetInnerHTML={{
                __html: t('dialog.delete.description')
                  .replace('{count}', String(selectedCount))
                  .replace('{plural}', plural),
              }}
            />
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-destructive">{t('dialog.delete.warning.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('dialog.delete.warning.description')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p
            className="text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{
              __html: t('dialog.delete.confirmPrompt').replace('{expectedText}', expectedText),
            }}
          />
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expectedText}
            className="font-mono"
            autoComplete="off"
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            {t('dialog.delete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isLoading}
            className="flex-1 sm:flex-none"
          >
            {isLoading ? t('dialog.delete.confirming') : t('dialog.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
