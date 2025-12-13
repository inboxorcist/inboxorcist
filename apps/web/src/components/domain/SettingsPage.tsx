import { Mail, Shield, LogOut, Moon, Sun, Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { GmailAccount } from "@/lib/api";

interface SettingsPageProps {
  account: GmailAccount;
  onDisconnect: () => void;
}

export function SettingsPage({ account, onDisconnect }: SettingsPageProps) {
  const { isDark, toggleTheme } = useTheme();
  const { isExorcistMode, toggleExorcistMode, t } = useLanguage();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

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

      {/* Account Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Connected Account
          </CardTitle>
          <CardDescription>Your linked Gmail account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{account.email}</p>
              <p className="text-sm text-muted-foreground">
                Connected {new Date(account.connectedAt).toLocaleDateString()}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Disconnect
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
                    onClick={onDisconnect}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
    </div>
  );
}
