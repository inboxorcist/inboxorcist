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
  const expectedText = `delete ${selectedCount} emails`
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
            Permanently Delete {selectedCount} Email{selectedCount > 1 ? 's' : ''}?
          </DialogTitle>
          <DialogDescription className="text-center space-y-3 pt-2">
            <p>
              You are about to <strong className="text-foreground">permanently delete</strong>{' '}
              {selectedCount} email{selectedCount > 1 ? 's' : ''} from your Gmail account.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-destructive">This action cannot be undone</p>
              <p className="text-sm text-muted-foreground">
                These emails will be permanently removed from Gmail's servers. You will not be able
                to recover them through Gmail, Inboxorcist, or any other means.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            To confirm, type{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
              {expectedText}
            </code>{' '}
            below:
          </p>
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
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isLoading}
            className="flex-1 sm:flex-none"
          >
            {isLoading ? 'Deleting...' : 'Delete Forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
