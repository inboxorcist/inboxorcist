import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccountStats, type QuickStats } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'

interface UseStatsReturn {
  stats: QuickStats | null
  syncStatus: string | null
  syncStartedAt: string | null
  syncCompletedAt: string | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

// Polling intervals
const WAITING_POLL_INTERVAL = 3000 // 3 seconds when waiting for data (skeleton showing)
const SYNCING_POLL_INTERVAL = 7000 // 7 seconds when syncing with data
const NO_POLL = false // Don't poll when idle

/**
 * Hook to fetch and manage Gmail account stats using React Query
 * Stats are read-only and only updated by the sync worker
 */
export function useStats(accountId: string | null): UseStatsReturn {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.stats(accountId ?? ''),
    queryFn: () => getAccountStats(accountId!),
    enabled: !!accountId,
    staleTime: 1000 * 3, // 3 seconds
    refetchInterval: (query) => {
      const syncStatus = query.state.data?.syncStatus
      const hasStats = !!query.state.data?.stats

      // Poll very frequently when syncing but no stats yet (skeleton showing)
      if (syncStatus === 'syncing' && !hasStats) {
        return WAITING_POLL_INTERVAL
      }

      // Poll frequently when syncing with data
      if (syncStatus === 'syncing') {
        return SYNCING_POLL_INTERVAL
      }

      // Don't poll when not syncing
      return NO_POLL
    },
  })

  const refetch = () => {
    if (accountId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.stats(accountId) })
    }
  }

  return {
    stats: data?.stats ?? null,
    syncStatus: data?.syncStatus ?? null,
    syncStartedAt: data?.syncStartedAt ?? null,
    syncCompletedAt: data?.syncCompletedAt ?? null,
    isLoading,
    error: error?.message ?? null,
    refetch,
  }
}
