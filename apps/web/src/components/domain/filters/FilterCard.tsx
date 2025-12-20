import { Pencil, Trash2, Play, Loader2, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { GmailFilter, GmailLabel } from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'

interface FilterCardProps {
  filter: GmailFilter
  onEdit: (filter: GmailFilter) => void
  onDelete: (filter: GmailFilter) => void
  onApply: (filter: GmailFilter) => void
  isApplying?: boolean
  labelsMap?: Map<string, GmailLabel>
}

export function FilterCard({
  filter,
  onEdit,
  onDelete,
  onApply,
  isApplying,
  labelsMap,
}: FilterCardProps) {
  const { t } = useLanguage()

  // Helper to get label info from ID
  const getLabel = (labelId: string) => {
    return labelsMap?.get(labelId)
  }

  // Build human-readable criteria description
  const getCriteriaDescription = () => {
    const parts: string[] = []

    if (filter.criteria.from) {
      parts.push(`from ${filter.criteria.from}`)
    }
    if (filter.criteria.to) {
      parts.push(`to ${filter.criteria.to}`)
    }
    if (filter.criteria.subject) {
      parts.push(`subject contains "${filter.criteria.subject}"`)
    }
    if (filter.criteria.query) {
      parts.push(`contains "${filter.criteria.query}"`)
    }
    if (filter.criteria.negatedQuery) {
      parts.push(`doesn't contain "${filter.criteria.negatedQuery}"`)
    }
    if (filter.criteria.hasAttachment) {
      parts.push('has attachment')
    }
    if (filter.criteria.size && filter.criteria.sizeComparison) {
      const sizeInMB = (filter.criteria.size / (1024 * 1024)).toFixed(1)
      parts.push(
        `size ${filter.criteria.sizeComparison === 'larger' ? 'larger' : 'smaller'} than ${sizeInMB}MB`
      )
    }

    return parts.join(', ')
  }

  // Build human-readable actions list
  const getActions = () => {
    const actions: { text: string; color?: string }[] = []

    if (filter.action.removeLabelIds?.includes('INBOX')) {
      actions.push({ text: 'Skip inbox' })
    }
    if (filter.action.removeLabelIds?.includes('UNREAD')) {
      actions.push({ text: 'Mark as read' })
    }
    if (filter.action.addLabelIds?.includes('STARRED')) {
      actions.push({ text: 'Add star', color: 'text-yellow-500' })
    }
    if (filter.action.addLabelIds?.includes('IMPORTANT')) {
      actions.push({ text: 'Mark important', color: 'text-amber-500' })
    }
    if (filter.action.removeLabelIds?.includes('IMPORTANT')) {
      actions.push({ text: 'Never important' })
    }
    if (filter.action.addLabelIds?.includes('TRASH')) {
      actions.push({ text: 'Delete', color: 'text-red-500' })
    }
    if (filter.action.removeLabelIds?.includes('SPAM')) {
      actions.push({ text: 'Never spam', color: 'text-green-500' })
    }
    if (filter.action.forward) {
      actions.push({ text: `Forward to ${filter.action.forward}` })
    }

    // Custom labels
    filter.action.addLabelIds
      ?.filter((id) => !['STARRED', 'IMPORTANT', 'TRASH', 'INBOX', 'UNREAD', 'SPAM'].includes(id))
      .forEach((labelId) => {
        const label = getLabel(labelId)
        actions.push({
          text: `Apply label "${label?.name || labelId}"`,
        })
      })

    return actions
  }

  const criteriaDescription = getCriteriaDescription()
  const actions = getActions()

  return (
    <div
      className="group border rounded-lg bg-card hover:border-primary/40 transition-colors cursor-pointer"
      onClick={() => onEdit(filter)}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Criteria - "When" part */}
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0 pt-0.5 w-12">
                When
              </span>
              <p className="text-sm">{criteriaDescription || 'All emails'}</p>
            </div>

            {/* Actions - "Then" part */}
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0 pt-0.5 w-12">
                Then
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {actions.map((action, i) => (
                  <span key={i} className="flex items-center">
                    <span className={`text-sm font-medium ${action.color || ''}`}>
                      {action.text}
                    </span>
                    {i < actions.length - 1 && (
                      <span className="text-muted-foreground mx-1.5">·</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onApply(filter)}
              disabled={isApplying}
              title={t('filters.apply.tooltip')}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(filter)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('filters.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onApply(filter)}>
                  <Play className="h-4 w-4 mr-2" />
                  {t('filters.apply')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(filter)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('filters.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}
