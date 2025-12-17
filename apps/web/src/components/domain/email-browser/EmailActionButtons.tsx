import { Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmailActionButtonsProps {
  selectedCount: number
  nonTrashedCount: number
  isActionLoading: boolean
  isTrashing: boolean
  isDeleting: boolean
  onTrash: () => void
  onDelete: () => void
}

export function EmailActionButtons({
  selectedCount,
  nonTrashedCount,
  isActionLoading,
  isTrashing,
  isDeleting,
  onTrash,
  onDelete,
}: EmailActionButtonsProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {/* Only show Trash button if there are non-trashed emails selected */}
      {nonTrashedCount > 0 && (
        <Button variant="secondary" size="sm" onClick={onTrash} disabled={isActionLoading}>
          {isTrashing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Trash {nonTrashedCount.toLocaleString()}
        </Button>
      )}
      <Button variant="destructive" size="sm" onClick={onDelete} disabled={isActionLoading}>
        {isDeleting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <AlertTriangle className="h-4 w-4 mr-2" />
        )}
        Delete {selectedCount.toLocaleString()}
      </Button>
    </div>
  )
}
