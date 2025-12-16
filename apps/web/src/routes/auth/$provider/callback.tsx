import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { exchangeOAuthCode } from '@/lib/auth'
import { useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/auth/$provider/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const { provider } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const exchangeStarted = useRef(false)

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent double execution in React StrictMode or after success
      if (exchangeStarted.current) return
      if (status === 'success') return
      exchangeStarted.current = true

      // Only google is supported for now
      if (provider !== 'google') {
        setErrorMessage(`Unsupported provider: ${provider}`)
        setStatus('error')
        setTimeout(() => navigate({ to: '/login', replace: true }), 2000)
        return
      }

      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const errorParam = params.get('error')

      if (errorParam) {
        setErrorMessage(errorParam)
        setStatus('error')
        setTimeout(() => navigate({ to: '/login', replace: true }), 2000)
        return
      }

      if (!code || !state) {
        // No code/state - either user landed here directly or component re-rendered after success
        // Just redirect silently - root layout will handle auth check
        navigate({ to: '/', replace: true })
        return
      }

      try {
        const result = await exchangeOAuthCode(code, state)

        if (result.success !== true) {
          setErrorMessage(result.message || 'Authentication failed')
          setStatus('error')
          setTimeout(() => navigate({ to: '/login', replace: true }), 2000)
          return
        }

        setStatus('success')

        // Invalidate queries to refetch data
        await queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })

        // For account_added, also invalidate accounts list
        if (result.type === 'account_added') {
          await queryClient.invalidateQueries({ queryKey: ['accounts'] })
        }

        // Navigate based on result
        const redirectUrl = result.redirectUrl || '/'
        const searchParams = new URLSearchParams()

        if (result.type === 'login') {
          if (result.isNewUser) searchParams.set('welcome', 'true')
          if (result.isNewAccount && result.accountId)
            searchParams.set('account_connected', result.accountId)
        } else if (result.type === 'account_added') {
          if (result.accountId) searchParams.set('account_added', result.accountId)
          searchParams.set('is_new', String(result.isNew))
        }

        const search = searchParams.toString()
        navigate({
          to: redirectUrl,
          search: search ? Object.fromEntries(searchParams) : undefined,
          replace: true,
        })
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Authentication failed')
        setStatus('error')
        setTimeout(() => navigate({ to: '/login', replace: true }), 2000)
      }
    }

    handleCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- status is intentionally excluded to prevent re-running
  }, [provider, navigate, queryClient])

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Authentication failed</p>
          <p className="text-zinc-500 text-sm">{errorMessage}</p>
          <p className="text-zinc-600 text-xs mt-4">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Show loading for both "loading" and "success" states (success redirects immediately)
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-zinc-400">
          {status === 'success' ? 'Redirecting...' : 'Completing sign in...'}
        </p>
      </div>
    </div>
  )
}
