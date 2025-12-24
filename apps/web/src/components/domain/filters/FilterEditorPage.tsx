import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Filter,
  Zap,
  Loader2,
  Mail,
  User,
  FileText,
  Search,
  Ban,
  Paperclip,
  HardDrive,
  AlertCircle,
  Check,
  Archive,
  MailOpen,
  Star,
  ChevronUp,
  ChevronDown,
  Trash2,
  ShieldOff,
  Tag,
  PlayCircle,
  X,
  Lightbulb,
  Sparkles,
  GraduationCap,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Stepper } from '@/components/ui/stepper'
import {
  createFilter,
  updateFilter,
  applyFilter,
  getLabels,
  getFilters,
  testFilterCriteria,
  type FilterCriteria,
  type FilterAction,
} from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'
import { LabelFormDialog } from './LabelFormDialog'

interface FilterEditorPageProps {
  accountId: string
  filterId?: string // If provided, we're editing
}

export function FilterEditorPage({ accountId, filterId }: FilterEditorPageProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!filterId

  // Steps for the stepper - defined inside component to use translations
  const STEPS = [
    {
      id: 'criteria',
      title: t('filterEditor.step.criteria'),
      description: t('filterEditor.step.criteriaDesc'),
      icon: <Filter className="h-4 w-4" />,
    },
    {
      id: 'actions',
      title: t('filterEditor.step.actions'),
      description: t('filterEditor.step.actionsDesc'),
      icon: <Zap className="h-4 w-4" />,
    },
  ]

  // Current step state
  const [currentStep, setCurrentStep] = useState(0)

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

  // Preview state
  const [showPreview, setShowPreview] = useState(false)

  // Create label dialog state
  const [showCreateLabelDialog, setShowCreateLabelDialog] = useState(false)

  // Fetch existing filter if editing
  const { data: filtersData, isLoading: filtersLoading } = useQuery({
    queryKey: ['filters', accountId],
    queryFn: () => getFilters(accountId),
    enabled: isEditing,
  })

  const editFilter = useMemo(() => {
    if (!filterId || !filtersData) return null
    return filtersData.filters.find((f) => f.id === filterId) || null
  }, [filterId, filtersData])

  // Fetch user labels
  const { data: labelsData } = useQuery({
    queryKey: ['labels', accountId],
    queryFn: () => getLabels(accountId),
  })

  const userLabels = labelsData?.userLabels || []

  // Build criteria for preview
  const currentCriteria = useMemo((): FilterCriteria => {
    const criteria: FilterCriteria = {}
    if (from.trim()) criteria.from = from.trim()
    if (to.trim()) criteria.to = to.trim()
    if (subject.trim()) criteria.subject = subject.trim()
    if (hasWords.trim()) criteria.query = hasWords.trim()
    if (doesntHave.trim()) criteria.negatedQuery = doesntHave.trim()
    if (hasAttachment) criteria.hasAttachment = true
    if (sizeEnabled && sizeValue) {
      const sizeInBytes = parseFloat(sizeValue) * 1024 * 1024
      if (!isNaN(sizeInBytes) && sizeInBytes > 0) {
        criteria.size = Math.round(sizeInBytes)
        criteria.sizeComparison = sizeComparison
      }
    }
    return criteria
  }, [
    from,
    to,
    subject,
    hasWords,
    doesntHave,
    hasAttachment,
    sizeEnabled,
    sizeValue,
    sizeComparison,
  ])

  // Test/preview filter
  const {
    data: previewData,
    isLoading: previewLoading,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ['filterPreview', accountId, currentCriteria],
    queryFn: () => testFilterCriteria(accountId, currentCriteria),
    enabled: showPreview && !!hasCriteria(),
    staleTime: 0,
  })

  // Populate form when editing
  /* eslint-disable react-hooks/set-state-in-effect -- Form initialization from props is a valid pattern */
  useEffect(() => {
    if (editFilter) {
      setFrom(editFilter.criteria.from || '')
      setTo(editFilter.criteria.to || '')
      setSubject(editFilter.criteria.subject || '')
      setHasWords(editFilter.criteria.query || '')
      setDoesntHave(editFilter.criteria.negatedQuery || '')
      setHasAttachment(editFilter.criteria.hasAttachment || false)
      if (editFilter.criteria.size && editFilter.criteria.sizeComparison) {
        setSizeEnabled(true)
        setSizeValue(String(editFilter.criteria.size / (1024 * 1024)))
        setSizeComparison(editFilter.criteria.sizeComparison)
      }

      // Actions
      setSkipInbox(editFilter.action.removeLabelIds?.includes('INBOX') || false)
      setMarkAsRead(editFilter.action.removeLabelIds?.includes('UNREAD') || false)
      setStarIt(editFilter.action.addLabelIds?.includes('STARRED') || false)
      setMarkImportant(editFilter.action.addLabelIds?.includes('IMPORTANT') || false)
      setNeverImportant(editFilter.action.removeLabelIds?.includes('IMPORTANT') || false)
      setDeleteIt(editFilter.action.addLabelIds?.includes('TRASH') || false)
      setNeverSpam(editFilter.action.removeLabelIds?.includes('SPAM') || false)

      const customLabel = editFilter.action.addLabelIds?.find(
        (id) => !['STARRED', 'IMPORTANT', 'TRASH', 'INBOX', 'UNREAD', 'SPAM'].includes(id)
      )
      setApplyLabel(customLabel || '')
    }
  }, [editFilter])
  /* eslint-enable react-hooks/set-state-in-effect */

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
  function hasCriteria(): boolean {
    return !!(
      from.trim() ||
      to.trim() ||
      subject.trim() ||
      hasWords.trim() ||
      doesntHave.trim() ||
      hasAttachment ||
      (sizeEnabled && sizeValue)
    )
  }

  function hasAction() {
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

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: {
      criteria: FilterCriteria
      action: FilterAction
      applyToExisting: boolean
    }) => {
      const result = await createFilter(accountId, data.criteria, data.action)
      if (data.applyToExisting && result.filter?.id) {
        const applyResult = await applyFilter(accountId, result.filter.id)
        return { ...result, applyResult }
      }
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['filters', accountId] })
      if ('applyResult' in result && result.applyResult) {
        toast.success(result.applyResult.message || t('filters.created'))
      } else {
        toast.success(t('filters.created'))
      }
      navigate({ to: '/filters' })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('filters.error.create'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { filterId: string; criteria: FilterCriteria; action: FilterAction }) =>
      updateFilter(accountId, data.filterId, data.criteria, data.action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters', accountId] })
      toast.success(t('filters.updated'))
      navigate({ to: '/filters' })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('filters.error.update'))
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSubmit = hasCriteria() && hasAction() && !isPending

  const handleSubmit = () => {
    if (!canSubmit) return

    const criteria = currentCriteria
    const action = buildAction()

    if (isEditing && filterId) {
      updateMutation.mutate({ filterId, criteria, action })
    } else {
      createMutation.mutate({ criteria, action, applyToExisting })
    }
  }

  const handleNext = () => {
    if (currentStep === 0 && hasCriteria()) {
      setCurrentStep(1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    } else {
      navigate({ to: '/filters' })
    }
  }

  // Loading state for edit
  if (isEditing && filtersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    )
  }

  // Not found state
  if (isEditing && !filtersLoading && !editFilter) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold mb-2">{t('filterEditor.notFound.title')}</h1>
          <p className="text-muted-foreground mb-4">{t('filterEditor.notFound.description')}</p>
          <Button onClick={() => navigate({ to: '/filters' })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('filterEditor.backToFilters')}
          </Button>
        </div>
      </div>
    )
  }

  // Get criteria summary for display
  const getCriteriaSummary = () => {
    const parts: string[] = []
    if (from.trim()) parts.push(`from:${from.trim()}`)
    if (to.trim()) parts.push(`to:${to.trim()}`)
    if (subject.trim()) {
      // Don't double-quote if already quoted
      const subj = subject.trim()
      const needsQuotes = !subj.startsWith('"') && subj.includes(' ')
      parts.push(`subject:${needsQuotes ? `"${subj}"` : subj}`)
    }
    if (hasWords.trim()) parts.push(hasWords.trim())
    if (doesntHave.trim()) parts.push(`-{${doesntHave.trim()}}`)
    if (hasAttachment) parts.push('has:attachment')
    if (sizeEnabled && sizeValue) {
      parts.push(`size:${sizeComparison === 'larger' ? '>' : '<'}${sizeValue}MB`)
    }
    return parts.join(' ')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? t('filterEditor.edit.title') : t('filterEditor.create.title')}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? t('filterEditor.edit.description') : t('filterEditor.create.description')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/filters' })}
          className="shrink-0 h-10 w-10"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Stepper */}
      <div className="max-w-3xl">
        <Stepper
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
          allowClickBack={hasCriteria()}
        />
      </div>

      {/* Main Content Area - Form + Tips Sidebar */}
      <div className="flex gap-6 items-start">
        {/* Step Content */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (currentStep === 0) {
              handleNext()
            } else {
              handleSubmit()
            }
          }}
          className="flex-1 max-w-3xl min-w-0"
        >
          {/* Step 1: Criteria */}
          {currentStep === 0 && (
            <div className="space-y-4">
              {/* Sender Criteria */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{t('filterEditor.sender.title')}</CardTitle>
                  </div>
                  <CardDescription>{t('filterEditor.sender.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="from" className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {t('filters.form.from')}
                      </Label>
                      <Input
                        id="from"
                        placeholder={t('filterEditor.sender.fromPlaceholder')}
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('filterEditor.sender.fromHint')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="to" className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {t('filters.form.to')}
                      </Label>
                      <Input
                        id="to"
                        placeholder={t('filterEditor.sender.toPlaceholder')}
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('filterEditor.sender.toHint')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content Criteria */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{t('filterEditor.content.title')}</CardTitle>
                  </div>
                  <CardDescription>{t('filterEditor.content.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="flex items-center gap-2">
                      {t('filters.form.subject')}
                    </Label>
                    <Input
                      id="subject"
                      placeholder={t('filterEditor.content.subjectPlaceholder')}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hasWords" className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      {t('filters.form.hasWords')}
                    </Label>
                    <Input
                      id="hasWords"
                      placeholder={t('filterEditor.content.hasWordsPlaceholder')}
                      value={hasWords}
                      onChange={(e) => setHasWords(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('filterEditor.content.hasWordsHint')}{' '}
                      <code className="bg-muted px-1 rounded">OR</code>{' '}
                      <code className="bg-muted px-1 rounded">AND</code>{' '}
                      <code className="bg-muted px-1 rounded">"quotes"</code>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doesntHave" className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-muted-foreground" />
                      {t('filters.form.doesntHave')}
                    </Label>
                    <Input
                      id="doesntHave"
                      placeholder={t('filterEditor.content.doesntHavePlaceholder')}
                      value={doesntHave}
                      onChange={(e) => setDoesntHave(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('filterEditor.content.doesntHaveHint')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Criteria */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{t('filterEditor.additional.title')}</CardTitle>
                  </div>
                  <CardDescription>{t('filterEditor.additional.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="hasAttachment" className="cursor-pointer">
                          {t('filterEditor.additional.hasAttachment')}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t('filterEditor.additional.hasAttachmentHint')}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="hasAttachment"
                      checked={hasAttachment}
                      onCheckedChange={setHasAttachment}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label htmlFor="sizeEnabled" className="cursor-pointer">
                            {t('filterEditor.additional.filterBySize')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('filterEditor.additional.filterBySizeHint')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="sizeEnabled"
                        checked={sizeEnabled}
                        onCheckedChange={setSizeEnabled}
                      />
                    </div>
                    {sizeEnabled && (
                      <div className="flex items-center gap-3 ml-7">
                        <Select
                          value={sizeComparison}
                          onValueChange={(v) => setSizeComparison(v as 'larger' | 'smaller')}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="larger">
                              {t('filterEditor.additional.largerThan')}
                            </SelectItem>
                            <SelectItem value="smaller">
                              {t('filterEditor.additional.smallerThan')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="10"
                          value={sizeValue}
                          onChange={(e) => setSizeValue(e.target.value)}
                          className="w-24"
                          min="0"
                          step="0.1"
                        />
                        <span className="text-sm text-muted-foreground">MB</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Criteria Preview */}
              {hasCriteria() && (
                <Card className="border-primary/50 bg-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{t('filterEditor.preview.title')}</p>
                        <code className="text-xs text-muted-foreground mt-1 block bg-muted/50 px-2 py-1 rounded">
                          {getCriteriaSummary()}
                        </code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Validation message */}
              {!hasCriteria() && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {t('filterEditor.preview.needCriteria')}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Actions */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Criteria Summary */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {t('filterEditor.test.whenMatch')}
                      </span>
                      <code className="text-xs bg-background px-2 py-0.5 rounded">
                        {getCriteriaSummary()}
                      </code>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentStep(0)}
                    >
                      {t('filterEditor.test.editCriteria')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlayCircle className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{t('filterEditor.test.title')}</CardTitle>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowPreview(true)
                        refetchPreview()
                      }}
                      disabled={previewLoading}
                    >
                      {previewLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('filterEditor.test.testing')}
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          {t('filterEditor.test.preview')}
                        </>
                      )}
                    </Button>
                  </div>
                  <CardDescription>{t('filterEditor.test.description')}</CardDescription>
                </CardHeader>
                {showPreview && (
                  <CardContent>
                    {previewLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : previewData ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={previewData.count > 0 ? 'default' : 'secondary'}>
                            {previewData.count.toLocaleString()}{' '}
                            {t('filterEditor.test.matchingEmails')}
                          </Badge>
                          {previewData.count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t('filterEditor.test.inInbox')}
                            </span>
                          )}
                        </div>
                        {previewData.samples && previewData.samples.length > 0 && (
                          <div className="border rounded-lg divide-y">
                            {previewData.samples.slice(0, 5).map((email, i) => (
                              <div key={i} className="px-3 py-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate">
                                    {email.from || 'Unknown sender'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {email.date}
                                  </span>
                                </div>
                                <p className="text-muted-foreground truncate">
                                  {email.subject || '(No subject)'}
                                </p>
                              </div>
                            ))}
                            {previewData.count > 5 && (
                              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                {t('filterEditor.test.andMore').replace(
                                  '{count}',
                                  String(previewData.count - 5)
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {previewData.count === 0 && (
                          <p className="text-sm text-muted-foreground">
                            {t('filterEditor.test.noMatches')}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                )}
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{t('filterEditor.actions.title')}</CardTitle>
                  </div>
                  <CardDescription>{t('filterEditor.actions.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {/* Organization Actions */}
                  <div className="py-3 border-b">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      {t('filterEditor.actions.organization')}
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={skipInbox}
                          onCheckedChange={(checked) => setSkipInbox(checked === true)}
                        />
                        <Archive className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm">{t('filterEditor.actions.skipInbox')}</span>
                          <p className="text-xs text-muted-foreground">
                            {t('filterEditor.actions.skipInboxHint')}
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={markAsRead}
                          onCheckedChange={(checked) => setMarkAsRead(checked === true)}
                        />
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm">{t('filterEditor.actions.markRead')}</span>
                          <p className="text-xs text-muted-foreground">
                            {t('filterEditor.actions.markReadHint')}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Importance Actions */}
                  <div className="py-3 border-b">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      {t('filterEditor.actions.importance')}
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={starIt}
                          onCheckedChange={(checked) => setStarIt(checked === true)}
                        />
                        <Star className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm">{t('filterEditor.actions.star')}</span>
                          <p className="text-xs text-muted-foreground">
                            {t('filterEditor.actions.starHint')}
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={markImportant}
                          onCheckedChange={(checked) => {
                            setMarkImportant(checked === true)
                            if (checked) setNeverImportant(false)
                          }}
                        />
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm">{t('filterEditor.actions.markImportant')}</span>
                          <p className="text-xs text-muted-foreground">
                            {t('filterEditor.actions.markImportantHint')}
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={neverImportant}
                          onCheckedChange={(checked) => {
                            setNeverImportant(checked === true)
                            if (checked) setMarkImportant(false)
                          }}
                        />
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm">
                            {t('filterEditor.actions.neverImportant')}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {t('filterEditor.actions.neverImportantHint')}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Destructive Actions */}
                  <div className="py-3 border-b">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      {t('filterEditor.actions.cleanup')}
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={neverSpam}
                          onCheckedChange={(checked) => setNeverSpam(checked === true)}
                        />
                        <ShieldOff className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm">{t('filterEditor.actions.neverSpam')}</span>
                          <p className="text-xs text-muted-foreground">
                            {t('filterEditor.actions.neverSpamHint')}
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer text-destructive">
                        <Checkbox
                          checked={deleteIt}
                          onCheckedChange={(checked) => setDeleteIt(checked === true)}
                        />
                        <Trash2 className="h-4 w-4" />
                        <div>
                          <span className="text-sm">{t('filterEditor.actions.delete')}</span>
                          <p className="text-xs opacity-70">
                            {t('filterEditor.actions.deleteHint')}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="py-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      {t('filterEditor.actions.labeling')}
                    </p>
                    <div className="flex items-center gap-3">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('filterEditor.actions.applyLabel')}</span>
                      <Select
                        value={applyLabel}
                        onValueChange={(value) => {
                          if (value === '__create__') {
                            setShowCreateLabelDialog(true)
                          } else {
                            setApplyLabel(value)
                          }
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder={t('filterEditor.actions.chooseLabel')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            {t('filterEditor.actions.noLabel')}
                          </SelectItem>
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
                          <SelectItem value="__create__" className="text-primary">
                            <div className="flex items-center gap-2">
                              <Plus className="h-3 w-3" />
                              {t('filterEditor.actions.createLabel')}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Apply to existing */}
              {!isEditing && previewData && previewData.count > 0 && (
                <Card className="border-amber-500/50 bg-amber-500/5">
                  <CardContent className="py-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={applyToExisting}
                        onCheckedChange={(checked) => setApplyToExisting(checked === true)}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          {t('filterEditor.applyExisting.title').replace(
                            '{count}',
                            previewData.count.toLocaleString()
                          )}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('filterEditor.applyExisting.description')}
                        </p>
                      </div>
                    </label>
                  </CardContent>
                </Card>
              )}

              {/* Validation message */}
              {!hasAction() && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {t('filterEditor.actions.needAction')}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentStep === 0 ? t('filterEditor.nav.cancel') : t('filterEditor.nav.back')}
            </Button>

            {currentStep === 0 ? (
              <Button type="submit" disabled={!hasCriteria()}>
                {t('filterEditor.nav.continue')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={!canSubmit}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditing ? t('filterEditor.nav.saving') : t('filterEditor.nav.creating')}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {isEditing ? t('filterEditor.nav.save') : t('filterEditor.nav.create')}
                  </>
                )}
              </Button>
            )}
          </div>
        </form>

        {/* Tips Sidebar */}
        <aside className="hidden xl:flex xl:flex-col flex-1 max-w-sm space-y-4">
          {currentStep === 0 ? (
            <>
              {/* Quick Examples */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  {t('filterEditor.tips.examples')}
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {t('filterEditor.tips.multipleSenders')}
                    </p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block">
                      john@gmail.com OR jane@gmail.com
                    </code>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {t('filterEditor.tips.entireDomain')}
                    </p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block">@company.com</code>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {t('filterEditor.tips.newsletters')}
                    </p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block">
                      unsubscribe OR "manage preferences"
                    </code>
                  </div>
                </div>
              </div>

              {/* Search Syntax */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <GraduationCap className="h-4 w-4" />
                  {t('filterEditor.tips.searchSyntax')}
                </div>
                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <code className="bg-muted px-1.5 py-0.5 rounded">OR</code>
                    <span className="text-muted-foreground">{t('filterEditor.tips.or')}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <code className="bg-muted px-1.5 py-0.5 rounded">"exact phrase"</code>
                    <span className="text-muted-foreground">{t('filterEditor.tips.exact')}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <code className="bg-muted px-1.5 py-0.5 rounded">-exclude</code>
                    <span className="text-muted-foreground">{t('filterEditor.tips.exclude')}</span>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <span className="text-foreground font-medium">
                        {t('filterEditor.tips.tip')}
                      </span>{' '}
                      {t('filterEditor.tips.orInFields')}
                    </p>
                    <p>{t('filterEditor.tips.combineConditions')}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Action Combinations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  {t('filterEditor.tips.recommendedCombos')}
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs font-medium mb-1">
                      {t('filterEditor.tips.newsletterOrg')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('filterEditor.tips.newsletterOrgDesc')}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs font-medium mb-1">{t('filterEditor.tips.vipSenders')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('filterEditor.tips.vipSendersDesc')}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs font-medium mb-1">
                      {t('filterEditor.tips.quietNotifications')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('filterEditor.tips.quietNotificationsDesc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  {t('filterEditor.tips.tips')}
                </div>
                <div className="p-3 rounded-lg border bg-card text-xs text-muted-foreground space-y-2">
                  <p>
                    <span className="text-foreground font-medium">Skip Inbox</span> —{' '}
                    {t('filterEditor.tips.skipInboxTip')}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Never Spam</span> —{' '}
                    {t('filterEditor.tips.neverSpamTip')}
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <span className="text-destructive font-medium">Delete</span>{' '}
                      {t('filterEditor.tips.deleteWarning')}
                    </p>
                    <p>{t('filterEditor.tips.testWarning')}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Create Label Dialog */}
      <LabelFormDialog
        accountId={accountId}
        open={showCreateLabelDialog}
        onOpenChange={setShowCreateLabelDialog}
      />
    </div>
  )
}
