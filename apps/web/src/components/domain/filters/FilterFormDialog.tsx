import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createFilter,
  updateFilter,
  applyFilter,
  getLabels,
  type GmailFilter,
  type FilterCriteria,
  type FilterAction,
} from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'

interface FilterFormDialogProps {
  accountId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  editFilter?: GmailFilter | null // If provided, we're editing
}

export function FilterFormDialog({
  accountId,
  open,
  onOpenChange,
  editFilter,
}: FilterFormDialogProps) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const isEditing = !!editFilter

  // Form state - Criteria
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [hasWords, setHasWords] = useState('')
  const [doesntHave, setDoesntHave] = useState('')
  const [hasAttachment, setHasAttachment] = useState(false)
  const [sizeEnabled, setSizeEnabled] = useState(false)
  const [sizeValue, setSizeValue] = useState('')
  const [sizeComparison, setSizeComparison] = useState<'larger' | 'smaller'>('larger')

  // Form state - Actions
  const [skipInbox, setSkipInbox] = useState(false)
  const [markAsRead, setMarkAsRead] = useState(false)
  const [starIt, setStarIt] = useState(false)
  const [markImportant, setMarkImportant] = useState(false)
  const [neverImportant, setNeverImportant] = useState(false)
  const [deleteIt, setDeleteIt] = useState(false)
  const [neverSpam, setNeverSpam] = useState(false)
  const [applyLabel, setApplyLabel] = useState<string>('')
  const [applyToExisting, setApplyToExisting] = useState(false)

  // Fetch user labels for dropdown
  const { data: labelsData } = useQuery({
    queryKey: ['labels', accountId],
    queryFn: () => getLabels(accountId),
    enabled: open,
  })

  const userLabels = labelsData?.userLabels || []

  // Reset form when dialog opens/closes or editFilter changes
  const resetForm = () => {
    setFrom('')
    setTo('')
    setSubject('')
    setHasWords('')
    setDoesntHave('')
    setHasAttachment(false)
    setSizeEnabled(false)
    setSizeValue('')
    setSizeComparison('larger')
    setSkipInbox(false)
    setMarkAsRead(false)
    setStarIt(false)
    setMarkImportant(false)
    setNeverImportant(false)
    setDeleteIt(false)
    setNeverSpam(false)
    setApplyLabel('')
    setApplyToExisting(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect -- Form initialization from props is a valid pattern */
  useEffect(() => {
    if (open) {
      if (editFilter) {
        // Populate form with existing filter data
        setFrom(editFilter.criteria.from || '')
        setTo(editFilter.criteria.to || '')
        setSubject(editFilter.criteria.subject || '')
        setHasWords(editFilter.criteria.query || '')
        setDoesntHave(editFilter.criteria.negatedQuery || '')
        setHasAttachment(editFilter.criteria.hasAttachment || false)
        if (editFilter.criteria.size && editFilter.criteria.sizeComparison) {
          setSizeEnabled(true)
          setSizeValue(String(editFilter.criteria.size / (1024 * 1024))) // Convert to MB
          setSizeComparison(editFilter.criteria.sizeComparison)
        } else {
          setSizeEnabled(false)
          setSizeValue('')
          setSizeComparison('larger')
        }

        // Actions
        setSkipInbox(editFilter.action.removeLabelIds?.includes('INBOX') || false)
        setMarkAsRead(editFilter.action.removeLabelIds?.includes('UNREAD') || false)
        setStarIt(editFilter.action.addLabelIds?.includes('STARRED') || false)
        setMarkImportant(editFilter.action.addLabelIds?.includes('IMPORTANT') || false)
        setNeverImportant(editFilter.action.removeLabelIds?.includes('IMPORTANT') || false)
        setDeleteIt(editFilter.action.addLabelIds?.includes('TRASH') || false)
        setNeverSpam(editFilter.action.removeLabelIds?.includes('SPAM') || false)

        // Find custom label (not system labels)
        const customLabel = editFilter.action.addLabelIds?.find(
          (id) => !['STARRED', 'IMPORTANT', 'TRASH', 'INBOX', 'UNREAD', 'SPAM'].includes(id)
        )
        setApplyLabel(customLabel || '')
      } else {
        // Reset to defaults for new filter
        resetForm()
      }
    }
  }, [open, editFilter])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      criteria: FilterCriteria
      action: FilterAction
      applyToExisting: boolean
    }) => {
      const result = await createFilter(accountId, data.criteria, data.action)
      // If applyToExisting is true, apply the filter to existing emails
      if (data.applyToExisting && result.filter?.id) {
        const applyResult = await applyFilter(accountId, result.filter.id)
        return { ...result, applyResult }
      }
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['filters', accountId] })
      if (result.applyResult) {
        toast.success(result.applyResult.message || t('filters.created'))
      } else {
        toast.success(t('filters.created'))
      }
      onOpenChange(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('filters.error.create'))
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { filterId: string; criteria: FilterCriteria; action: FilterAction }) =>
      updateFilter(accountId, data.filterId, data.criteria, data.action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters', accountId] })
      toast.success(t('filters.updated'))
      onOpenChange(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('filters.error.update'))
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  // Build criteria object
  const buildCriteria = (): FilterCriteria => {
    const criteria: FilterCriteria = {}
    if (from.trim()) criteria.from = from.trim()
    if (to.trim()) criteria.to = to.trim()
    if (subject.trim()) criteria.subject = subject.trim()
    if (hasWords.trim()) criteria.query = hasWords.trim()
    if (doesntHave.trim()) criteria.negatedQuery = doesntHave.trim()
    if (hasAttachment) criteria.hasAttachment = true
    if (sizeEnabled && sizeValue) {
      const sizeInBytes = parseFloat(sizeValue) * 1024 * 1024 // Convert MB to bytes
      if (!isNaN(sizeInBytes) && sizeInBytes > 0) {
        criteria.size = Math.round(sizeInBytes)
        criteria.sizeComparison = sizeComparison
      }
    }
    return criteria
  }

  // Build action object
  const buildAction = (): FilterAction => {
    const addLabelIds: string[] = []
    const removeLabelIds: string[] = []

    if (skipInbox) removeLabelIds.push('INBOX')
    if (markAsRead) removeLabelIds.push('UNREAD')
    if (starIt) addLabelIds.push('STARRED')
    if (markImportant) addLabelIds.push('IMPORTANT')
    if (neverImportant) removeLabelIds.push('IMPORTANT')
    if (deleteIt) addLabelIds.push('TRASH')
    if (neverSpam) removeLabelIds.push('SPAM')
    if (applyLabel && applyLabel !== '__none__') addLabelIds.push(applyLabel)

    const action: FilterAction = {}
    if (addLabelIds.length > 0) action.addLabelIds = addLabelIds
    if (removeLabelIds.length > 0) action.removeLabelIds = removeLabelIds
    return action
  }

  // Validation
  const hasCriteria = () => {
    return (
      from.trim() ||
      to.trim() ||
      subject.trim() ||
      hasWords.trim() ||
      doesntHave.trim() ||
      hasAttachment ||
      (sizeEnabled && sizeValue)
    )
  }

  const hasAction = () => {
    return (
      skipInbox ||
      markAsRead ||
      starIt ||
      markImportant ||
      neverImportant ||
      deleteIt ||
      neverSpam ||
      (applyLabel && applyLabel !== '__none__')
    )
  }

  const canSubmit = hasCriteria() && hasAction() && !isPending

  const handleSubmit = () => {
    if (!canSubmit) return

    const criteria = buildCriteria()
    const action = buildAction()

    if (isEditing && editFilter) {
      updateMutation.mutate({ filterId: editFilter.id, criteria, action })
    } else {
      createMutation.mutate({ criteria, action, applyToExisting })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('filters.edit.title') : t('filters.create.title')}
          </DialogTitle>
          <DialogDescription>{t('filters.form.description')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-6 py-4"
        >
          {/* Criteria Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('filters.form.criteria')}</h3>

            <div className="grid gap-4">
              {/* From */}
              <div className="grid gap-2">
                <Label htmlFor="from">{t('filters.form.from')}</Label>
                <Input
                  id="from"
                  placeholder="sender@example.com"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>

              {/* To */}
              <div className="grid gap-2">
                <Label htmlFor="to">{t('filters.form.to')}</Label>
                <Input
                  id="to"
                  placeholder="recipient@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              {/* Subject */}
              <div className="grid gap-2">
                <Label htmlFor="subject">{t('filters.form.subject')}</Label>
                <Input
                  id="subject"
                  placeholder="newsletter"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Has words */}
              <div className="grid gap-2">
                <Label htmlFor="hasWords">{t('filters.form.hasWords')}</Label>
                <Input
                  id="hasWords"
                  placeholder="unsubscribe OR newsletter"
                  value={hasWords}
                  onChange={(e) => setHasWords(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('filters.form.hasWordsHint')}</p>
              </div>

              {/* Doesn't have */}
              <div className="grid gap-2">
                <Label htmlFor="doesntHave">{t('filters.form.doesntHave')}</Label>
                <Input
                  id="doesntHave"
                  placeholder="important"
                  value={doesntHave}
                  onChange={(e) => setDoesntHave(e.target.value)}
                />
              </div>

              {/* Has attachment */}
              <div className="flex items-center gap-3">
                <Switch
                  id="hasAttachment"
                  checked={hasAttachment}
                  onCheckedChange={setHasAttachment}
                />
                <Label htmlFor="hasAttachment">{t('filters.form.hasAttachment')}</Label>
              </div>

              {/* Size */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch id="sizeEnabled" checked={sizeEnabled} onCheckedChange={setSizeEnabled} />
                  <Label htmlFor="sizeEnabled">{t('filters.form.sizeFilter')}</Label>
                </div>
                {sizeEnabled && (
                  <div className="flex items-center gap-2 ml-10">
                    <Select
                      value={sizeComparison}
                      onValueChange={(v) => setSizeComparison(v as 'larger' | 'smaller')}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="larger">Larger than</SelectItem>
                        <SelectItem value="smaller">Smaller than</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="10"
                      value={sizeValue}
                      onChange={(e) => setSizeValue(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">MB</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Actions Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('filters.form.actions')}</h3>

            <div className="grid gap-3">
              {/* Skip Inbox (Archive) */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="skipInbox"
                  checked={skipInbox}
                  onCheckedChange={(checked) => setSkipInbox(checked === true)}
                />
                <Label htmlFor="skipInbox" className="font-normal">
                  {t('filters.form.skipInbox')}
                </Label>
              </div>

              {/* Mark as read */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="markAsRead"
                  checked={markAsRead}
                  onCheckedChange={(checked) => setMarkAsRead(checked === true)}
                />
                <Label htmlFor="markAsRead" className="font-normal">
                  {t('filters.form.markAsRead')}
                </Label>
              </div>

              {/* Star it */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="starIt"
                  checked={starIt}
                  onCheckedChange={(checked) => setStarIt(checked === true)}
                />
                <Label htmlFor="starIt" className="font-normal">
                  {t('filters.form.starIt')}
                </Label>
              </div>

              {/* Mark important */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="markImportant"
                  checked={markImportant}
                  onCheckedChange={(checked) => {
                    setMarkImportant(checked === true)
                    if (checked) setNeverImportant(false)
                  }}
                />
                <Label htmlFor="markImportant" className="font-normal">
                  {t('filters.form.markImportant')}
                </Label>
              </div>

              {/* Never mark important */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="neverImportant"
                  checked={neverImportant}
                  onCheckedChange={(checked) => {
                    setNeverImportant(checked === true)
                    if (checked) setMarkImportant(false)
                  }}
                />
                <Label htmlFor="neverImportant" className="font-normal">
                  {t('filters.form.neverImportant')}
                </Label>
              </div>

              {/* Never send to Spam */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="neverSpam"
                  checked={neverSpam}
                  onCheckedChange={(checked) => setNeverSpam(checked === true)}
                />
                <Label htmlFor="neverSpam" className="font-normal">
                  {t('filters.form.neverSpam')}
                </Label>
              </div>

              {/* Delete it */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="deleteIt"
                  checked={deleteIt}
                  onCheckedChange={(checked) => setDeleteIt(checked === true)}
                />
                <Label htmlFor="deleteIt" className="font-normal text-destructive">
                  {t('filters.form.deleteIt')}
                </Label>
              </div>

              {/* Apply label */}
              <div className="flex items-center gap-3">
                <Label className="font-normal shrink-0">{t('filters.form.applyLabel')}</Label>
                <Select value={applyLabel} onValueChange={setApplyLabel}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Choose a label..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {userLabels.map((label) => (
                      <SelectItem key={label.id} value={label.id}>
                        <div className="flex items-center gap-2">
                          {label.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: label.color.backgroundColor }}
                            />
                          )}
                          {label.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Apply to existing checkbox - only show for new filters */}
          {!isEditing && (
            <>
              <div className="border-t" />
              <div className="flex items-center gap-3">
                <Checkbox
                  id="applyToExisting"
                  checked={applyToExisting}
                  onCheckedChange={(checked) => setApplyToExisting(checked === true)}
                />
                <Label htmlFor="applyToExisting" className="font-normal">
                  {t('filters.form.applyToExisting')}
                </Label>
              </div>
            </>
          )}

          {/* Validation messages */}
          {!hasCriteria() && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t('filters.form.needCriteria')}
            </p>
          )}
          {hasCriteria() && !hasAction() && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t('filters.form.needAction')}
            </p>
          )}

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
                t('filters.create.submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
