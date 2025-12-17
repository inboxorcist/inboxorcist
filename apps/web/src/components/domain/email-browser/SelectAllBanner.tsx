import { CheckCircle2, X, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes } from './EmailTable'

interface SelectAllBannerProps {
  selectAllMode: 'page' | 'all'
  allPageSelected: boolean
  pageSize: number
  totalMatchingCount: number
  totalSizeBytes: number
  onSelectAllMatching: () => void
  onClearSelectAll: () => void
}

export function SelectAllBanner({
  selectAllMode,
  allPageSelected,
  pageSize,
  totalMatchingCount,
  totalSizeBytes,
  onSelectAllMatching,
  onClearSelectAll,
}: SelectAllBannerProps) {
  // Show banner when all items on current page are selected and there are more items
  const showSelectAllOption =
    selectAllMode === 'page' && allPageSelected && totalMatchingCount > pageSize

  // Show confirmation when in 'all' mode
  const showAllSelected = selectAllMode === 'all'

  if (!showSelectAllOption && !showAllSelected) {
    return null
  }

  return (
    <div className="border rounded-lg bg-card p-4">
      {showSelectAllOption && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">
                {totalMatchingCount.toLocaleString()} emails match this filter
              </p>
              {totalSizeBytes > 0 && (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {formatBytes(totalSizeBytes)} total
                </p>
              )}
            </div>
          </div>
          <Button onClick={onSelectAllMatching} variant="default" size="sm">
            Select all {totalMatchingCount.toLocaleString()}
          </Button>
        </div>
      )}

      {showAllSelected && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-primary">
                {totalMatchingCount.toLocaleString()} emails selected
              </p>
              {totalSizeBytes > 0 && (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {formatBytes(totalSizeBytes)} will be affected
                </p>
              )}
            </div>
          </div>
          <Button onClick={onClearSelectAll} variant="ghost" size="sm">
            <X className="h-4 w-4 mr-2" />
            Clear selection
          </Button>
        </div>
      )}
    </div>
  )
}
