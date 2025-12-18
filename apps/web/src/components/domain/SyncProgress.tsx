import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, PlayCircle, AlertCircle, Clock, Zap } from 'lucide-react'
import type { SyncProgress as SyncProgressType } from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'

interface SyncProgressProps {
  progress: SyncProgressType | null
  isLoading: boolean
  onResume: () => void
  showSkeleton?: boolean
}

// Skeleton component for sync progress
function SyncProgressSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-8 w-14" />
      </div>
      <Skeleton className="h-2 w-full rounded-full mb-4" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

/**
 * Sync progress display component - modern design with i18n support
 */
export function SyncProgress({
  progress,
  isLoading,
  onResume,
  showSkeleton = false,
}: SyncProgressProps) {
  const { t, tSyncPhase } = useLanguage()

  // Show skeleton when syncing but no progress data yet
  if (!progress || progress.status === 'no_sync') {
    if (showSkeleton) {
      return <SyncProgressSkeleton />
    }
    return null
  }

  const isActive = progress.status === 'running' || progress.status === 'pending'
  const isFailed = progress.status === 'failed'
  const isCompleted = progress.status === 'completed'

  // Don't show if completed
  if (isCompleted) {
    return null
  }

  // Get the title based on status
  const getTitle = () => {
    if (isFailed) return t('sync.title.failed')
    if (progress.status === 'pending') return t('sync.title.pending')
    if (progress.status === 'paused') return t('sync.title.paused')
    if (progress.status === 'cancelled') return t('sync.title.cancelled')
    return t('sync.title.active')
  }

  // Get the phase message based on percentage and status
  const phase = tSyncPhase(progress.percentage, progress.status)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header: Icon + Title/Phase + Badge | Percentage/Resume */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              isActive ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-red-100 dark:bg-red-500/20'
            }`}
          >
            {isActive ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
          </div>

          {/* Title + Phase subtitle */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{getTitle()}</h3>
              {isActive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                  <span className="w-1 h-1 bg-violet-500 rounded-full animate-pulse" />
                  {t('sync.badge')}
                </span>
              )}
            </div>
            {/* Phase as subtitle */}
            {isActive && <p className="text-sm text-muted-foreground">{phase}</p>}
          </div>
        </div>

        {/* Percentage or Resume button */}
        {isFailed ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onResume}
            disabled={isLoading}
            className="h-8"
          >
            <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
            {t('sync.resume')}
          </Button>
        ) : (
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {progress.percentage}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
            isFailed ? 'bg-red-500' : 'bg-violet-500'
          }`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      {/* Stats row: ETA and Rate */}
      {isActive && (
        <div className="flex items-center justify-between text-sm">
          {/* Left: ETA */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {progress.eta ? (
              <>
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {progress.eta} {t('sync.remaining')}
                </span>
              </>
            ) : (
              <span>{t('sync.calculating')}</span>
            )}
          </div>

          {/* Right: Rate */}
          {progress.rate !== null && progress.rate > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                ~{progress.rate} {t('sync.rate')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {isFailed && progress.message && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <p className="text-sm text-red-600 dark:text-red-400">{progress.message}</p>
        </div>
      )}
    </div>
  )
}
