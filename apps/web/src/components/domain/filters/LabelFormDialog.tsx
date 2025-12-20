import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createLabel,
  updateLabel,
  type GmailLabel,
  type CreateLabelRequest,
  type UpdateLabelRequest,
} from '@/lib/api'
import { LabelColorPicker } from './LabelColorPicker'
import { DEFAULT_LABEL_COLOR, type GmailLabelColor } from './gmail-colors'
import { useLanguage } from '@/hooks/useLanguage'

interface LabelFormDialogProps {
  accountId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  editLabel?: GmailLabel | null // If provided, we're editing
}

export function LabelFormDialog({
  accountId,
  open,
  onOpenChange,
  editLabel,
}: LabelFormDialogProps) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const isEditing = !!editLabel

  // Form state
  const [name, setName] = useState('')
  const [color, setColor] = useState<GmailLabelColor>(DEFAULT_LABEL_COLOR)

  const resetForm = () => {
    setName('')
    setColor(DEFAULT_LABEL_COLOR)
  }

  // Reset form when dialog opens/closes or editLabel changes
  /* eslint-disable react-hooks/set-state-in-effect -- Form initialization from props is a valid pattern */
  useEffect(() => {
    if (open) {
      if (editLabel) {
        setName(editLabel.name)
        if (editLabel.color) {
          setColor({
            backgroundColor: editLabel.color.backgroundColor,
            textColor: editLabel.color.textColor,
          })
        } else {
          setColor(DEFAULT_LABEL_COLOR)
        }
      } else {
        resetForm()
      }
    }
  }, [open, editLabel])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (request: CreateLabelRequest) => createLabel(accountId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', accountId] })
      toast.success(t('labels.created'))
      onOpenChange(false)
      resetForm()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t('labels.error.create')
      if (message.includes('already exists')) {
        toast.error(t('labels.error.duplicate'))
      } else {
        toast.error(message)
      }
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { labelId: string; request: UpdateLabelRequest }) =>
      updateLabel(accountId, data.labelId, data.request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', accountId] })
      toast.success(t('labels.updated'))
      onOpenChange(false)
      resetForm()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t('labels.error.update')
      if (message.includes('already exists')) {
        toast.error(t('labels.error.duplicate'))
      } else {
        toast.error(message)
      }
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  // Validation
  const isValid = name.trim().length > 0
  const canSubmit = isValid && !isPending

  const handleSubmit = () => {
    if (!canSubmit) return

    const request = {
      name: name.trim(),
      color: {
        backgroundColor: color.backgroundColor,
        textColor: color.textColor,
      },
      labelListVisibility: 'labelShow' as const,
      messageListVisibility: 'show' as const,
    }

    if (isEditing && editLabel) {
      updateMutation.mutate({ labelId: editLabel.id, request })
    } else {
      createMutation.mutate(request)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('labels.edit.title') : t('labels.create.title')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('labels.edit.description') : t('labels.create.description')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-6 py-4"
        >
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="labelName">{t('labels.form.name')}</Label>
            <Input
              id="labelName"
              placeholder={t('labels.form.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Color Preview */}
          <div className="space-y-2">
            <Label>{t('labels.form.preview')}</Label>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div
                className="px-3 py-1.5 rounded-md text-sm font-medium"
                style={{
                  backgroundColor: color.backgroundColor,
                  color: color.textColor,
                }}
              >
                {name.trim() || 'Label Name'}
              </div>
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>{t('labels.form.color')}</Label>
            <LabelColorPicker value={color} onChange={setColor} />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? t('common.saving') : t('common.creating')}
                </>
              ) : isEditing ? (
                t('common.save')
              ) : (
                t('labels.create.submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
