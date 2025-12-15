import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, PlayCircle, CheckCircle2, AlertCircle } from 'lucide-react'
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
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-3 w-24 mb-1" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-7 w-12" />
        </div>
      </div>
    </div>
  )
}

/**
 * Sync progress display component
 */
export function SyncProgress({
  progress,
  isLoading,
  onResume,
  showSkeleton = false,
}: SyncProgressProps) {
  const { t } = useLanguage()

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

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isActive
                  ? 'bg-violet-100 dark:bg-violet-500/20'
                  : isFailed
                    ? 'bg-red-100 dark:bg-red-500/20'
                    : 'bg-emerald-100 dark:bg-emerald-500/20'
              }`}
            >
              {isActive ? (
                <Loader2 className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400" />
              ) : isFailed ? (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  {isActive
                    ? t('sync.title.active')
                    : isFailed
                      ? t('sync.title.failed')
                      : t('sync.title.complete')}
                </h3>
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                    {t('sync.badge')}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{progress.phase}</p>
            </div>
          </div>

          {isFailed && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResume}
              disabled={isLoading}
              className="shrink-0"
            >
              <PlayCircle className="h-4 w-4 mr-1.5" />
              {t('sync.resume')}
            </Button>
          )}
        </div>

        {/* Progress section */}
        <div className="space-y-4">
          {/* Progress bar container */}
          <div className="relative">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{t('sync.progress')}</span>
            </div>
            <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              {/* Progress fill - simple solid color */}
              <div
                className="absolute inset-y-0 left-0 bg-violet-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between">
            {isActive && progress.eta && (
              <div>
                <p className="text-xs text-muted-foreground">{t('sync.timeRemaining')}</p>
                <p className="text-sm font-medium text-foreground">{progress.eta}</p>
              </div>
            )}
            {!progress.eta && <div />}

            {/* Percentage display */}
            <p className="text-xl font-semibold text-foreground tabular-nums">
              {progress.percentage}%
            </p>
          </div>
        </div>

        {/* Error message */}
        {isFailed && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <p className="text-sm text-red-600 dark:text-red-400">{progress.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
