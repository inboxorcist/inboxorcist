import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Ghost, Github, Zap, Shield, Trash2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { isExorcistMode, toggleExorcistMode, t } = useLanguage()
  const { setTheme } = useTheme()
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  // When enabling exorcist mode, also enable dark mode
  const handleExorcistToggle = () => {
    if (!isExorcistMode) {
      setTheme('dark')
    }
    toggleExorcistMode()
  }

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/', replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  const handleLogin = () => {
    login('/') // Redirect to dashboard after login
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex">
      {/* Left side - Branding */}
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

            {/* Tagline below logo */}
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

      {/* Right side - Login */}
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
            {/* Mobile logo - bigger and centered */}
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

            {/* Login section */}
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-1">{t('getStarted.title')}</h2>
                <p className="text-zinc-500 text-sm">{t('getStarted.subtitle')}</p>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900">
                    <Trash2 className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-zinc-400">{t('getStarted.feature1')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900">
                    <Zap className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-zinc-400">{t('getStarted.feature2')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900">
                    <Shield className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-zinc-400">{t('getStarted.feature3')}</span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full h-10 bg-white text-black hover:bg-zinc-100 font-semibold text-sm transition-all shadow-lg shadow-white/10"
              >
                <img src="/google.svg" alt="Google" className="h-4 w-4 mr-2" />
                {t('getStarted.connectButton')}
              </Button>
            </div>

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
