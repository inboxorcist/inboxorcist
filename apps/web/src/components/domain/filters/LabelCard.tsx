import { Pencil, Trash2, MoreVertical, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { GmailLabel } from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'

interface LabelCardProps {
  label: GmailLabel
  onEdit?: (label: GmailLabel) => void
  onDelete?: (label: GmailLabel) => void
}

export function LabelCard({ label, onEdit, onDelete }: LabelCardProps) {
  const { t } = useLanguage()

  const hasCustomColor = !!label.color?.backgroundColor

  return (
    <div
      className={`group flex items-center gap-2.5 p-3 rounded-lg transition-all ${
        hasCustomColor
          ? 'border border-transparent hover:border-current/20'
          : 'border border-border bg-card hover:border-primary/40'
      }`}
      style={
        hasCustomColor
          ? {
              backgroundColor: label.color?.backgroundColor,
              color: label.color?.textColor,
            }
          : undefined
      }
    >
      <Tag className="h-4 w-4 shrink-0 opacity-70" />
      <span className="text-sm font-medium truncate flex-1">{label.name}</span>

      {/* Message count */}
      {label.messagesTotal !== undefined && label.messagesTotal > 0 && (
        <span className="text-xs opacity-70">{label.messagesTotal.toLocaleString()}</span>
      )}

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10"
            style={hasCustomColor ? { color: label.color?.textColor } : undefined}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit?.(label)}>
            <Pencil className="h-4 w-4 mr-2" />
            {t('labels.edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete?.(label)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('labels.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
