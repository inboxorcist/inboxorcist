import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AuthExpiredBannerProps {
  email: string
  onReconnect: () => void
}

/**
 * Banner shown when OAuth tokens have expired and user needs to re-authenticate.
 * This typically happens when:
 * - The Google Cloud project is in "Testing" mode (7-day token expiry)
 * - The user revoked access in their Google account
 * - The user changed their Google password
 */
export function AuthExpiredBanner({ email, onReconnect }: AuthExpiredBannerProps) {
  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200">Reconnect Required</h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Your Gmail connection for <span className="font-medium">{email}</span> has expired. This
            can happen if you revoked access or if you're using a test app. Please reconnect to
            continue.
          </p>
          <Button
            onClick={onReconnect}
            className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconnect Gmail
          </Button>
        </div>
      </div>
    </div>
  )
}
