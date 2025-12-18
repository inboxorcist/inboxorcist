import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Ghost,
  Github,
  Lock,
  ExternalLink,
  Loader2,
  AlertCircle,
  Key,
  Copy,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'
import { getSetupStatus, saveSetupConfig, type SetupConfig } from '@/lib/api'

export const Route = createFileRoute('/setup')({
  component: SetupPage,
})

function SetupPage() {
  const { isExorcistMode, toggleExorcistMode, t } = useLanguage()
  const { setTheme } = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // When enabling exorcist mode, also enable dark mode
  const handleExorcistToggle = () => {
    if (!isExorcistMode) {
      setTheme('dark')
    }
    toggleExorcistMode()
  }

  // Track if we've initialized form state from API data
  const initializedRef = useRef(false)

  // Form state
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [appUrl, setAppUrl] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

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

  const redirectUri = `${appUrl || 'http://localhost:3000'}/auth/google/callback`

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri)
      setCopied(true)
      toast.success(t('setup.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('setup.copyFailed'))
    }
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
            <span className="text-sm">{t('getStarted.github')}</span>
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
              onCheckedChange={handleExorcistToggle}
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
            <form onSubmit={handleSubmit}>
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-1">{t('setup.title')}</h2>
                <p className="text-zinc-500 text-sm">{t('setup.subtitle')}</p>
              </div>

              {/* Setup guide banner */}
              <a
                href="https://inboxorcist.com/docs/google-oauth-setup"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 mb-6 rounded-lg bg-zinc-900 border-l-2 border-violet-500 hover:bg-zinc-800 transition-colors group"
              >
                <ExternalLink className="h-4 w-4 text-violet-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{t('setup.guideTitle')}</p>
                  <p className="text-xs text-zinc-500">{t('setup.guideDescription')}</p>
                </div>
              </a>

              {/* Form fields */}
              <div className="space-y-4">
                {/* Google Client ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                    {t('setup.clientId')}
                    {isClientIdFromEnv && (
                      <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        {t('setup.envBadge')}
                      </span>
                    )}
                  </label>
                  <Input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="123456789-abc.apps.googleusercontent.com"
                    disabled={isClientIdFromEnv}
                    className="h-9 bg-zinc-900 border-zinc-800 text-white text-sm placeholder:text-zinc-600 disabled:opacity-50 focus:border-violet-500 focus:ring-0"
                  />
                </div>

                {/* Google Client Secret */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                    {t('setup.clientSecret')}
                    {isClientSecretFromEnv && (
                      <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        {t('setup.envBadge')}
                      </span>
                    )}
                  </label>
                  <Input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={isClientSecretFromEnv ? '••••••••' : 'GOCSPX-...'}
                    disabled={isClientSecretFromEnv}
                    className="h-9 bg-zinc-900 border-zinc-800 text-white text-sm placeholder:text-zinc-600 disabled:opacity-50 focus:border-violet-500 focus:ring-0"
                  />
                </div>

                {/* App URL (optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                    {t('setup.appUrl')}
                    <span className="text-[10px] text-zinc-600">({t('setup.optional')})</span>
                    {isAppUrlFromEnv && (
                      <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        {t('setup.envBadge')}
                      </span>
                    )}
                  </label>
                  <Input
                    type="url"
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    placeholder="https://your-domain.com"
                    disabled={isAppUrlFromEnv}
                    className="h-9 bg-zinc-900 border-zinc-800 text-white text-sm placeholder:text-zinc-600 disabled:opacity-50 focus:border-violet-500 focus:ring-0"
                  />
                </div>

                {/* OAuth redirect URI */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    {t('setup.redirectUri')}
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 h-9 flex items-center text-xs bg-zinc-900 border border-zinc-800 rounded-md px-3 text-violet-400 truncate font-mono">
                      {redirectUri}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyRedirectUri}
                      className="h-9 w-9 p-0 text-zinc-500 hover:text-white hover:bg-zinc-800"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="flex items-start gap-3 p-3 mt-4 rounded-lg bg-red-950 border border-red-900">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
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
                className="w-full h-10 mt-5 bg-white text-black hover:bg-zinc-100 font-semibold text-sm transition-all"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                {saveMutation.isPending ? t('setup.submitting') : t('setup.submit')}
              </Button>

              {/* Security note */}
              <p className="text-[11px] text-zinc-600 text-center mt-3 flex items-center justify-center gap-1.5">
                <Lock className="h-3 w-3" />
                {t('setup.credentialsSecure')}
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
                <span className="text-sm">{t('getStarted.github')}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
