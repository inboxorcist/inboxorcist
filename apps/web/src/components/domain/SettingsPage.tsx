import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail,
  LogOut,
  Moon,
  Sun,
  Ghost,
  User,
  Monitor,
  Smartphone,
  Trash2,
  Loader2,
  AlertTriangle,
  Info,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  ArrowUpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuthContext } from '@/routes/__root'
import {
  getSessions,
  revokeSession,
  revokeAllOtherSessions,
  deleteAccount,
  type GmailAccount,
  type Session,
} from '@/lib/api'

// Version injected at build time from git tag (see vite.config.ts)
const APP_VERSION = __APP_VERSION__
const GITHUB_REPO = 'inboxorcist/inboxorcist'

interface SettingsPageProps {
  accounts: GmailAccount[]
  onDisconnect: (accountId: string) => void
  onAddAccount: () => void
}

interface GitHubRelease {
  tag_name: string
  html_url: string
  published_at: string
  body: string
}

// Parse user agent to get device type icon
function getDeviceIcon(userAgent: string | null) {
  if (!userAgent) return Monitor
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    return Smartphone
  }
  return Monitor
}

// Parse user agent to get device description
function getDeviceDescription(userAgent: string | null) {
  if (!userAgent) return 'Unknown device'

  const ua = userAgent.toLowerCase()
  let browser = 'Browser'
  let os = 'Unknown'

  // Detect browser
  if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('edg')) browser = 'Edge'
  else if (ua.includes('chrome')) browser = 'Chrome'
  else if (ua.includes('safari')) browser = 'Safari'

  // Detect OS
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac')) os = 'macOS'
  else if (ua.includes('linux')) os = 'Linux'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'
  else if (ua.includes('android')) os = 'Android'

  return `${browser} on ${os}`
}

// Compare version strings (e.g., "0.2.1" vs "0.2.0")
function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.replace(/^v/, '').split('.').map(Number)
  const currentParts = current.replace(/^v/, '').split('.').map(Number)

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0
    const c = currentParts[i] || 0
    if (l > c) return true
    if (l < c) return false
  }
  return false
}

export function SettingsPage({ accounts, onDisconnect, onAddAccount }: SettingsPageProps) {
  const { isDark, toggleTheme, setTheme } = useTheme()
  const { isExorcistMode, toggleExorcistMode, t } = useLanguage()

  // When enabling exorcist mode, also enable dark mode
  const handleExorcistToggle = () => {
    if (!isExorcistMode) {
      setTheme('dark')
    }
    toggleExorcistMode()
  }
  const { user, logout } = useAuthContext()
  const queryClient = useQueryClient()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Fetch sessions
  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery<Session[]>({
    queryKey: ['auth', 'sessions'],
    queryFn: getSessions,
  })

  // Fetch latest release from GitHub
  const {
    data: latestRelease,
    isLoading: releaseLoading,
    refetch: refetchRelease,
    isFetching: releaseFetching,
  } = useQuery<GitHubRelease | null>({
    queryKey: ['github', 'release'],
    queryFn: async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
        if (!res.ok) return null
        return res.json()
      } catch {
        return null
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  })

  // Revoke single session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] })
    },
  })

  // Revoke all other sessions mutation
  const revokeAllMutation = useMutation({
    mutationFn: revokeAllOtherSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] })
    },
  })

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      window.location.href = '/login'
    },
  })

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return user?.email?.[0]?.toUpperCase() ?? '?'
    const names = user.name.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
    }
    return user.name[0].toUpperCase()
  }

  // Count other active sessions
  const otherSessionsCount = sessions?.filter((s) => !s.current).length ?? 0

  // Version check
  const hasUpdate = latestRelease && isNewerVersion(latestRelease.tag_name, APP_VERSION)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Single column layout, centered */}
      <div className="max-w-2xl mx-auto space-y-6">
        {/* User Profile Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? 'User'} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{user?.name ?? 'User'}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                {user?.createdAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Member since {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connected Gmail Accounts Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Connected Accounts
              </CardTitle>
              <Button variant="outline" size="sm" onClick={onAddAccount} className="h-8 text-xs">
                <Mail className="h-3 w-3 mr-1.5" />
                Add
              </Button>
            </div>
            <CardDescription className="text-xs">Gmail accounts linked for cleanup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accounts.map((account) => {
                const isPrimary = account.email === user?.email
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{account.email}</p>
                        {isPrimary && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Connected {new Date(account.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!isPrimary && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                            <LogOut className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect Gmail Account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove{' '}
                              <span className="font-medium text-foreground">{account.email}</span>{' '}
                              from Inboxorcist. Your emails won't be affected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDisconnect(account.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                {isExorcistMode ? 'Active Rituals' : 'Active Sessions'}
              </CardTitle>
              {otherSessionsCount > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={revokeAllMutation.isPending}
                    >
                      {revokeAllMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      ) : (
                        <LogOut className="h-3 w-3 mr-1.5" />
                      )}
                      End others
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Log out of all other sessions?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will sign you out of {otherSessionsCount} other{' '}
                        {otherSessionsCount === 1 ? 'device' : 'devices'}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => revokeAllMutation.mutate()}>
                        Log out everywhere
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <CardDescription className="text-xs">Devices where you're signed in</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessionsError ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Failed to load sessions
              </div>
            ) : (
              <div className="space-y-2">
                {sessions?.map((session) => {
                  const DeviceIcon = getDeviceIcon(session.userAgent)
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-md bg-background border shrink-0">
                          <DeviceIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {getDeviceDescription(session.userAgent)}
                            </p>
                            {session.current && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {session.ipAddress && `${session.ipAddress} • `}
                            {new Date(session.lastUsedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={() => revokeSessionMutation.mutate(session.id)}
                          disabled={revokeSessionMutation.isPending}
                        >
                          {revokeSessionMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LogOut className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appearance Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              {isDark ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              Appearance
            </CardTitle>
            <CardDescription className="text-xs">Customize how Inboxorcist looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">
                  {isDark ? 'Dark mode enabled' : 'Light mode enabled'}
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-8" onClick={toggleTheme}>
                {isDark ? (
                  <Sun className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5 mr-1.5" />
                )}
                {isDark ? 'Light' : 'Dark'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Ghost className="h-3.5 w-3.5" />
                  {t('settings.exorcistMode')}
                </p>
                <p className="text-xs text-muted-foreground">{t('settings.exorcistMode.desc')}</p>
              </div>
              <Button
                variant={isExorcistMode ? 'default' : 'outline'}
                size="sm"
                className={`h-8 ${isExorcistMode ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                onClick={handleExorcistToggle}
              >
                {isExorcistMode ? t('settings.exorcistMode.on') : t('settings.exorcistMode.off')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About & Version Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              About
            </CardTitle>
            <CardDescription className="text-xs">Version and update information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Current Version</p>
                <p className="text-xs text-muted-foreground font-mono">{APP_VERSION}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => refetchRelease()}
                disabled={releaseFetching}
              >
                {releaseFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {releaseLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : hasUpdate ? (
              <div className="p-3 rounded-md border border-primary/50 bg-primary/5">
                <div className="flex items-start gap-3">
                  <ArrowUpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">Update Available</p>
                    <p className="text-xs text-muted-foreground">
                      Version {latestRelease?.tag_name} is available
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs mt-2"
                      onClick={() => window.open(latestRelease?.html_url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      View Release
                    </Button>
                  </div>
                </div>
              </div>
            ) : latestRelease ? (
              <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-muted-foreground">You're on the latest version</p>
              </div>
            ) : null}

            <a
              href={`https://github.com/${GITHUB_REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span className="text-sm">GitHub Repository</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>

        {/* Danger Zone Card */}
        <Card className="border-destructive/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-xs">Irreversible actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md border border-destructive/20 bg-destructive/5">
              <div>
                <p className="text-sm font-medium">Log out everywhere</p>
                <p className="text-xs text-muted-foreground">Sign out of all devices</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    Log out all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Log out of all devices?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be signed out everywhere, including this device.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={logout}>Log out everywhere</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md border border-destructive/20 bg-destructive/5">
              <div>
                <p className="text-sm font-medium text-destructive">Delete account</p>
                <p className="text-xs text-muted-foreground">Permanently delete all data</p>
              </div>
              <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="h-8">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        This action is{' '}
                        <span className="font-medium text-destructive">permanent</span>.
                      </p>
                      <ul className="list-disc list-inside text-sm ml-2">
                        <li>Your user profile will be deleted</li>
                        <li>All connected Gmail accounts removed</li>
                        <li>All synced email metadata erased</li>
                      </ul>
                      <p className="pt-2 text-xs">Your actual Gmail emails are not affected.</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAccountMutation.mutate()}
                      disabled={deleteAccountMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteAccountMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Delete account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
