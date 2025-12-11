import { useGmailAccounts } from "@/hooks/useGmailAccounts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";

function App() {
  const { accounts, isLoading, error, connectAccount, removeAccount } =
    useGmailAccounts();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl py-12 px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Inboxorcist
          </h1>
          <p className="text-muted-foreground text-lg">
            The power of delete compels you
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              Connect your Gmail accounts to begin the exorcism
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                  <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">
                  No demons detected yet. Connect a Gmail account to begin.
                </p>
                <Button onClick={connectAccount}>
                  <Plus className="h-4 w-4" />
                  Connect Gmail
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {account.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{account.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Connected{" "}
                          {new Date(account.connectedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAccount(account.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={connectAccount}
                >
                  <Plus className="h-4 w-4" />
                  Connect Another Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coming Soon */}
        {accounts.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Begin the Ritual</CardTitle>
              <CardDescription>
                Select an account above to start cleansing your inbox
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Email cleanup features coming soon...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;
