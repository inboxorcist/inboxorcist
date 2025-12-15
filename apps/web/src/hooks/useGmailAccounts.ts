import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { getAccounts, getOAuthUrl, disconnectAccount, type GmailAccount } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'

interface OAuthCallbackResult {
  accountId: string
  isNew: boolean
}

interface UseGmailAccountsReturn {
  accounts: GmailAccount[]
  isLoading: boolean
  isConnecting: boolean
  error: string | null
  oauthCallback: OAuthCallbackResult | null
  clearOAuthCallback: () => void
  connectAccount: () => Promise<void>
  removeAccount: (accountId: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useGmailAccounts(): UseGmailAccountsReturn {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [oauthCallback, setOAuthCallback] = useState<OAuthCallbackResult | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  // Query for fetching accounts
  const {
    data: accounts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: getAccounts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Mutation for disconnecting account
  const disconnectMutation = useMutation({
    mutationFn: disconnectAccount,
    onSuccess: (_, accountId) => {
      // Optimistically update the cache
      queryClient.setQueryData<GmailAccount[]>(
        queryKeys.accounts,
        (old) => old?.filter((acc) => acc.id !== accountId) ?? []
      )
      // Also invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['syncProgress'] })
    },
  })

  // Handle OAuth callback results from URL params (after adding account)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const accountAdded = params.get('account_added')
    const isNew = params.get('is_new') === 'true'

    if (accountAdded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing state from URL params after OAuth redirect
      setOAuthCallback({ accountId: accountAdded, isNew })
      // Refresh accounts list after successful OAuth
      refetch()
      // Clear URL params using router navigation
      navigate({ to: location.pathname, replace: true })
    }
  }, [location.search, refetch, navigate, location.pathname])

  const clearOAuthCallback = useCallback(() => {
    setOAuthCallback(null)
  }, [])

  const connectAccount = useCallback(async () => {
    setIsConnecting(true)
    try {
      const { url } = await getOAuthUrl('/', true) // addAccount = true
      window.location.href = url
    } catch (err) {
      console.error('[OAuth] Failed to get URL:', err)
      setIsConnecting(false)
    }
  }, [])

  const removeAccount = useCallback(
    async (accountId: string) => {
      await disconnectMutation.mutateAsync(accountId)
    },
    [disconnectMutation]
  )

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    accounts,
    isLoading,
    isConnecting,
    error: error?.message ?? disconnectMutation.error?.message ?? null,
    oauthCallback,
    clearOAuthCallback,
    connectAccount,
    removeAccount,
    refresh,
  }
}
