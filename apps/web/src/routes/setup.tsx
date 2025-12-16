import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Ghost, Github, Lock, ExternalLink, Loader2, AlertCircle, Key } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { getSetupStatus, saveSetupConfig, type SetupConfig } from '@/lib/api'

export const Route = createFileRoute('/setup')({
  component: SetupPage,
})

function SetupPage() {
  const { isExorcistMode, toggleExorcistMode, t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Track if we've initialized form state from API data
  const initializedRef = useRef(false)

  // Form state
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [appUrl, setAppUrl] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  // Fetch current setup status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['setupStatus'],
    queryFn: getSetupStatus,
  })

  // Save config mutation
  const saveMutation = useMutation({
    mutationFn: saveSetupConfig,
    onSuccess: (data) => {
      if (data.success && data.setupCompleted) {
        // Invalidate status and redirect to login
        queryClient.invalidateQueries({ queryKey: ['setupStatus'] })
        navigate({ to: '/login', replace: true })
      } else if (data.errors) {
        setErrors(data.errors)
      }
    },
    onError: (error) => {
      setErrors([error instanceof Error ? error.message : 'Failed to save configuration'])
    },
  })

  // Populate form with existing values (only once when data first loads)
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: Initialize form state from API response on initial load */
  useEffect(() => {
    if (status && !initializedRef.current) {
      initializedRef.current = true
      if (status.config.google_client_id.value) {
        setClientId(status.config.google_client_id.value)
      }
      if (status.config.app_url.value) {
        setAppUrl(status.config.app_url.value)
      }
    }
  }, [status])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Redirect if setup is already complete
  useEffect(() => {
    if (status && !status.setupRequired && status.setupCompleted) {
      navigate({ to: '/login', replace: true })
    }
  }, [status, navigate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const config: SetupConfig = {}

    // Only include editable fields
    if (status?.config.google_client_id.isEditable && clientId) {
      config.google_client_id = clientId
    }
    if (status?.config.google_client_secret.isEditable && clientSecret) {
      config.google_client_secret = clientSecret
    }
    if (status?.config.app_url.isEditable && appUrl) {
      config.app_url = appUrl
    }

    saveMutation.mutate(config)
  }

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    )
  }

  const isClientIdFromEnv = status?.config.google_client_id.source === 'env'
  const isClientSecretFromEnv = status?.config.google_client_secret.source === 'env'
  const isAppUrlFromEnv = status?.config.app_url.source === 'env'

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex">
      {/* Left side - Branding (same as login) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-violet-600/40 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-cyan-500/20 rounded-full blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo header */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Inboxorcist" className="h-10 w-10" />
            <span className="text-xl font-semibold">Inboxorcist</span>
          </div>

          {/* Center - Big Logo */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-8">
            <div className="relative">
              {/* Glow effect behind logo */}
              <div className="absolute inset-0 bg-violet-500/30 blur-[60px] scale-110 rounded-full" />
              <img
                src="/logo.png"
                alt="Inboxorcist"
                className="relative z-10 h-56 w-56 drop-shadow-2xl animate-float"
              />
            </div>

            {/* Tagline below logo (same as login) */}
            <div className="mt-10 text-center max-w-md">
              <h1 className="text-4xl font-bold tracking-tight mb-4 leading-tight">
                {t('getStarted.tagline1')}
                <br />
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  {t('getStarted.tagline2')}
                </span>
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed">{t('getStarted.description')}</p>
            </div>
          </div>

          {/* GitHub */}
          <a
            href="https://github.com/inboxorcist/inboxorcist"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors w-fit"
          >
            <Github className="h-5 w-5" />
            <span className="text-sm">Star on GitHub</span>
          </a>
        </div>
      </div>

      {/* Right side - Setup Form */}
      <div className="flex-1 flex flex-col p-6 lg:p-8">
        {/* Top bar with Exorcist Mode toggle */}
        <div className="flex justify-end mb-4 lg:mb-0">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="flex items-center gap-2 text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
              <Ghost className={`h-4 w-4 ${isExorcistMode ? 'text-violet-400' : ''}`} />
              <span>{t('settings.exorcistMode')}</span>
            </div>
            <Switch
              checked={isExorcistMode}
              onCheckedChange={toggleExorcistMode}
              className="data-[state=checked]:bg-violet-600"
            />
          </label>
        </div>

        {/* Center content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex flex-col items-center mb-10 lg:hidden">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-violet-500/20 blur-[40px] scale-110 rounded-full" />
                <img
                  src="/logo.png"
                  alt="Inboxorcist"
                  className="relative z-10 h-32 w-32 drop-shadow-xl animate-float"
                />
              </div>
              <span className="text-2xl font-semibold">Inboxorcist</span>
              <p className="text-zinc-500 text-center mt-2 text-sm">
                {t('getStarted.description')}
              </p>
            </div>

            {/* Setup section */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-3">
                  {isExorcistMode ? 'Prepare the Ritual' : 'Initial Setup'}
                </h2>
                <p className="text-zinc-400 text-lg">
                  {isExorcistMode
                    ? 'Configure the sacred credentials'
                    : 'Configure your Google OAuth credentials'}
                </p>
              </div>

              {/* Google Client ID */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  Google Client ID
                  {isClientIdFromEnv && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      env
                    </span>
                  )}
                </label>
                <Input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="123456789-abc.apps.googleusercontent.com"
                  disabled={isClientIdFromEnv}
                  className="h-12 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 disabled:opacity-50 focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>

              {/* Google Client Secret */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  Google Client Secret
                  {isClientSecretFromEnv && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      env
                    </span>
                  )}
                </label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={isClientSecretFromEnv ? '••••••••' : 'GOCSPX-...'}
                  disabled={isClientSecretFromEnv}
                  className="h-12 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 disabled:opacity-50 focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>

              {/* App URL (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  App URL
                  <span className="text-xs text-zinc-500">(optional)</span>
                  {isAppUrlFromEnv && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      env
                    </span>
                  )}
                </label>
                <Input
                  type="url"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  placeholder="https://your-domain.com"
                  disabled={isAppUrlFromEnv}
                  className="h-12 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 disabled:opacity-50 focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-900/20 border border-red-800/50">
                  <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-300">
                    {errors.map((error, i) => (
                      <p key={i}>{error}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                size="lg"
                disabled={saveMutation.isPending}
                className="w-full h-14 bg-white text-black hover:bg-zinc-100 font-semibold text-base transition-all"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Key className="h-5 w-5 mr-2" />
                )}
                {isExorcistMode ? 'Begin the Ritual' : 'Save & Continue'}
              </Button>

              {/* Info indicators */}
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3 text-sm text-zinc-500">
                  <ExternalLink className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                  <span>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300"
                    >
                      Get credentials
                    </a>{' '}
                    from Google Cloud Console
                  </span>
                </div>
                <div className="flex items-start gap-3 text-sm text-zinc-500">
                  <Lock className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                  <span>Credentials are encrypted and stored locally</span>
                </div>
              </div>

              {/* OAuth redirect URI info */}
              <p className="text-xs text-zinc-600 text-center pt-2">
                OAuth Redirect URI:{' '}
                <code className="text-violet-400/80">
                  {appUrl || 'http://localhost:6616'}/auth/google/callback
                </code>
              </p>
            </form>

            {/* Mobile GitHub */}
            <div className="mt-8 text-center lg:hidden">
              <a
                href="https://github.com/inboxorcist/inboxorcist"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
              >
                <Github className="h-5 w-5" />
                <span className="text-sm">Star on GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
