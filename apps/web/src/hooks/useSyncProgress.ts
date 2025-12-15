import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSyncProgress, startSync, cancelSync, resumeSync, type SyncProgress } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'

interface UseSyncProgressReturn {
  progress: SyncProgress | null
  isLoading: boolean
  error: string | null
  start: () => Promise<void>
  cancel: () => Promise<void>
  resume: () => Promise<void>
  refresh: () => Promise<void>
}

// Polling intervals
const WAITING_POLL_INTERVAL = 3000 // 3 seconds when waiting for data (skeleton showing)
const ACTIVE_POLL_INTERVAL = 10000 // 10 seconds when active with data
const IDLE_POLL_INTERVAL = 30000 // 30 seconds when idle/completed

/**
 * Hook to manage sync progress with React Query polling
 */
export function useSyncProgress(accountId: string | null): UseSyncProgressReturn {
  const queryClient = useQueryClient()

  // Query for fetching sync progress with smart polling
  const {
    data: progress,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.syncProgress(accountId ?? ''),
    queryFn: () => getSyncProgress(accountId!),
    enabled: !!accountId,
    staleTime: 1000 * 3, // 3 seconds
    refetchInterval: (query) => {
      const data = query.state.data
      const status = data?.status
      const syncStatus = data?.syncStatus

      // Poll very frequently when syncStatus is "syncing" but no job data yet (skeleton showing)
      if (syncStatus === 'syncing' && (status === 'no_sync' || !status)) {
        return WAITING_POLL_INTERVAL
      }

      // Poll frequently when sync is active
      if (status === 'running' || status === 'pending') {
        return ACTIVE_POLL_INTERVAL
      }

      // Poll less frequently when idle/completed
      return IDLE_POLL_INTERVAL
    },
  })

  // Mutation for starting sync
  const startMutation = useMutation({
    mutationFn: () => startSync(accountId!),
    onSuccess: (response) => {
      // Update progress with new job info
      queryClient.setQueryData<SyncProgress>(queryKeys.syncProgress(accountId!), (old) => ({
        ...old,
        jobId: response.jobId,
        status: response.status,
        processed: 0,
        total: response.totalMessages,
        percentage: 0,
        eta: null,
        phase: 'Preparing the ritual...',
        message: response.message,
        syncStatus: 'syncing',
      }))
      // Invalidate stats to show syncing state
      queryClient.invalidateQueries({ queryKey: queryKeys.stats(accountId!) })
    },
  })

  // Mutation for canceling sync
  const cancelMutation = useMutation({
    mutationFn: () => cancelSync(accountId!),
    onSuccess: () => {
      // Refetch to get the cancelled state
      refetch()
      // Also invalidate stats
      queryClient.invalidateQueries({ queryKey: queryKeys.stats(accountId!) })
    },
  })

  // Mutation for resuming sync
  const resumeMutation = useMutation({
    mutationFn: () => resumeSync(accountId!),
    onSuccess: (response) => {
      // Update progress
      queryClient.setQueryData<SyncProgress>(queryKeys.syncProgress(accountId!), (old) =>
        old
          ? {
              ...old,
              jobId: response.jobId,
              status: response.status,
              phase: 'Resuming the ritual...',
              message: response.message,
            }
          : undefined
      )
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: queryKeys.stats(accountId!) })
    },
  })

  const start = async () => {
    if (!accountId) return
    await startMutation.mutateAsync()
  }

  const cancel = async () => {
    if (!accountId) return
    await cancelMutation.mutateAsync()
  }

  const resume = async () => {
    if (!accountId) return
    await resumeMutation.mutateAsync()
  }

  const refresh = async () => {
    await refetch()
  }

  const isLoading =
    isQueryLoading ||
    startMutation.isPending ||
    cancelMutation.isPending ||
    resumeMutation.isPending

  const error =
    queryError?.message ??
    startMutation.error?.message ??
    cancelMutation.error?.message ??
    resumeMutation.error?.message ??
    null

  return {
    progress: progress ?? null,
    isLoading,
    error,
    start,
    cancel,
    resume,
    refresh,
  }
}
