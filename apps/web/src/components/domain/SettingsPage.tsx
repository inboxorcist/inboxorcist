import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Shield,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuthContext } from "@/routes/__root";
import {
  getSessions,
  revokeSession,
  revokeAllOtherSessions,
  deleteAccount,
  type GmailAccount,
  type Session,
} from "@/lib/api";

interface SettingsPageProps {
  accounts: GmailAccount[];
  onDisconnect: (accountId: string) => void;
  onAddAccount: () => void;
}

// Parse user agent to get device type icon
function getDeviceIcon(userAgent: string | null) {
  if (!userAgent) return Monitor;
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
    return Smartphone;
  }
  return Monitor;
}

// Parse user agent to get device description
function getDeviceDescription(userAgent: string | null) {
  if (!userAgent) return "Unknown device";

  const ua = userAgent.toLowerCase();
  let browser = "Browser";
  let os = "Unknown";

  // Detect browser
  if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("safari")) browser = "Safari";

  // Detect OS
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("android")) os = "Android";

  return `${browser} on ${os}`;
}

export function SettingsPage({ accounts, onDisconnect, onAddAccount }: SettingsPageProps) {
  const { isDark, toggleTheme } = useTheme();
  const { isExorcistMode, toggleExorcistMode, t } = useLanguage();
  const { user, logout } = useAuthContext();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Fetch sessions
  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery<Session[]>({
    queryKey: ["auth", "sessions"],
    queryFn: getSessions,
  });

  // Revoke single session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
  });

  // Revoke all other sessions mutation
  const revokeAllMutation = useMutation({
    mutationFn: revokeAllOtherSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      window.location.href = "/login";
    },
  });

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return user?.email?.[0]?.toUpperCase() ?? "?";
    const names = user.name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return user.name[0].toUpperCase();
  };

  // Count other active sessions
  const otherSessionsCount = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your Inboxorcist account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? "User"} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-medium">{user?.name ?? "User"}</p>
              <p className="text-muted-foreground">{user?.email}</p>
              {user?.createdAt && (
                <p className="text-sm text-muted-foreground mt-1">
                  Member since {new Date(user.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Gmail Accounts Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Connected Gmail Accounts
              </CardTitle>
              <CardDescription>Your linked Gmail accounts for cleanup</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onAddAccount}>
              <Mail className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accounts.map((account) => {
              // Primary account is the one used for login (matches user email)
              const isPrimary = account.email === user?.email;
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{account.email}</p>
                      {isPrimary && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Connected {new Date(account.connectedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!isPrimary && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <LogOut className="h-4 w-4" />
                          <span className="sr-only">Disconnect</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Gmail Account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove <span className="font-medium text-foreground">{account.email}</span> from Inboxorcist.
                            Your emails won't be affected, but you'll need to reconnect to use cleanup features again.
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
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                {isExorcistMode ? "Active Rituals" : "Active Sessions"}
              </CardTitle>
              <CardDescription>
                Devices where you're signed in
              </CardDescription>
            </div>
            {otherSessionsCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={revokeAllMutation.isPending}>
                    {revokeAllMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4 mr-2" />
                    )}
                    {isExorcistMode ? "End all other rituals" : "Log out everywhere else"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isExorcistMode ? "End all other rituals?" : "Log out of all other sessions?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will sign you out of {otherSessionsCount} other {otherSessionsCount === 1 ? "device" : "devices"}.
                      Your current session will remain active.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => revokeAllMutation.mutate()}
                    >
                      {isExorcistMode ? "End rituals" : "Log out everywhere"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessionsError ? (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load sessions
            </div>
          ) : (
            <div className="space-y-3">
              {sessions?.map((session) => {
                const DeviceIcon = getDeviceIcon(session.userAgent);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-background">
                        <DeviceIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {getDeviceDescription(session.userAgent)}
                          </p>
                          {session.current && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              {isExorcistMode ? "This vessel" : "This device"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {session.ipAddress && `${session.ipAddress} • `}
                          Last active {new Date(session.lastUsedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {!session.current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeSessionMutation.mutate(session.id)}
                        disabled={revokeSessionMutation.isPending}
                      >
                        {revokeSessionMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {isExorcistMode ? "End ritual" : "Sign out"}
                        </span>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            Appearance
          </CardTitle>
          <CardDescription>Customize how Inboxorcist looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">
                {isDark ? "Currently using dark theme" : "Currently using light theme"}
              </p>
            </div>
            <Button variant="outline" onClick={toggleTheme}>
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 mr-2" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 mr-2" />
                  Dark Mode
                </>
              )}
            </Button>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <Ghost className="h-4 w-4" />
                  {t("settings.exorcistMode")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.exorcistMode.desc")}
                </p>
              </div>
              <Button
                variant={isExorcistMode ? "default" : "outline"}
                onClick={toggleExorcistMode}
                className={isExorcistMode ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                <Ghost className="h-4 w-4 mr-2" />
                {isExorcistMode ? t("settings.exorcistMode.on") : t("settings.exorcistMode.off")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Security
          </CardTitle>
          <CardDescription>How we handle your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">Local Processing</p>
              <p className="text-sm text-muted-foreground">
                All email processing happens locally. Your email content is never
                sent to our servers.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">Metadata Only</p>
              <p className="text-sm text-muted-foreground">
                We only store email metadata (sender, date, size) for analysis.
                Email bodies are never stored.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">Encrypted Tokens</p>
              <p className="text-sm text-muted-foreground">
                Your OAuth tokens are encrypted at rest and never shared.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Log out everywhere</p>
              <p className="text-sm text-muted-foreground">
                Sign out of all devices, including this one
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out everywhere
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Log out of all devices?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will be signed out of all devices, including this one.
                    You'll need to sign in again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={logout}>
                    Log out everywhere
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-destructive">Delete account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data
                </p>
              </div>
              <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>This action is <span className="font-medium text-destructive">permanent and cannot be undone</span>.</p>
                      <p>The following will be deleted:</p>
                      <ul className="list-disc list-inside text-sm ml-2">
                        <li>Your user profile</li>
                        <li>All connected Gmail accounts</li>
                        <li>All synced email metadata</li>
                        <li>All active sessions</li>
                      </ul>
                      <p className="pt-2">Your actual Gmail emails will not be affected.</p>
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
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
