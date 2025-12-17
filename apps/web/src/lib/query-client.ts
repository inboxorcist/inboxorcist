import { QueryClient } from '@tanstack/react-query'

/**
 * Query client with default configuration
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

/**
 * Query keys for type-safe invalidation
 */
export const queryKeys = {
  accounts: ['accounts'] as const,
  stats: (accountId: string) => ['stats', accountId] as const,
  syncProgress: (accountId: string) => ['syncProgress', accountId] as const,
  topSenders: (accountId: string) => ['topSenders', accountId] as const,
  summary: (accountId: string) => ['summary', accountId] as const,
  subscriptions: (accountId: string, page: number, filters?: object) =>
    ['subscriptions', accountId, page, filters] as const,
}
