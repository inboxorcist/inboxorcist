import { HardDrive, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface StorageInfoProps {
  totalSizeBytes: number
  totalCount: number
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function StorageInfo({ totalSizeBytes, totalCount }: StorageInfoProps) {
  if (totalCount === 0) return null

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <HardDrive className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-primary">
              {formatBytes(totalSizeBytes)} can be freed
            </p>
            <p className="text-sm text-muted-foreground">
              from {totalCount.toLocaleString()} email{totalCount !== 1 ? 's' : ''} matching your
              filters
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trash2 className="h-5 w-5" />
            <span className="text-sm">Select emails to delete</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
