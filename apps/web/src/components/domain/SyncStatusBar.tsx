import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { deltaSync, type DeltaSyncResponse } from '@/lib/api'

interface SyncStatusBarProps {
  accountId: string
  syncStartedAt: string | null
  syncCompletedAt: string | null
  syncStatus: string | null
  onSyncComplete?: () => void
}

/**
 * Format a date string to relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}

export function SyncStatusBar({
  accountId,
  syncStartedAt,
  syncCompletedAt,
  syncStatus,
  onSyncComplete,
}: SyncStatusBarProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<DeltaSyncResponse | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const isSyncing = syncStatus === 'syncing'

  // Use syncCompletedAt if available, otherwise syncStartedAt
  const lastSyncTime = syncCompletedAt || syncStartedAt

  const handleRefresh = async () => {
    if (isRefreshing || isSyncing) return

    setIsRefreshing(true)
    setRefreshResult(null)
    setRefreshError(null)

    try {
      const result = await deltaSync(accountId)
      setRefreshResult(result)

      // Call the callback to refresh stats
      if (onSyncComplete) {
        onSyncComplete()
      }

      // Clear the result after 5 seconds
      setTimeout(() => setRefreshResult(null), 5000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh'
      setRefreshError(message)
      // Clear error after 5 seconds
      setTimeout(() => setRefreshError(null), 5000)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-lg">
      {/* Status indicator dot */}
      <div
        className={`h-2 w-2 rounded-full ${
          isRefreshing || isSyncing
            ? 'bg-blue-500 animate-pulse'
            : refreshError
              ? 'bg-red-500'
              : 'bg-emerald-500'
        }`}
      />

      {/* Info */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground/80">
          {isRefreshing
            ? 'Syncing...'
            : refreshError
              ? 'Sync failed'
              : formatRelativeTime(lastSyncTime)}
        </span>
        {refreshResult && refreshResult.type === 'delta' && (
          <span className="text-[10px] text-muted-foreground">
            {refreshResult.added || 0} added · {refreshResult.deleted || 0} removed
          </span>
        )}
      </div>

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing || isSyncing}
        className="ml-1 p-1.5 rounded-lg hover:bg-muted/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        title="Refresh emails"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  )
}
