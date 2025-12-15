import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Tag,
  Users,
  Bell,
  MessageSquare,
  Inbox,
  HardDrive,
  Calendar,
  MailOpen,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { QuickStats } from "@/lib/api";

interface StatsCardsProps {
  stats: QuickStats | null;
  isLoading: boolean;
  onRefresh: () => void;
  syncStatus?: string;
}

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/**
 * Single stat card
 */
function StatCard({
  icon: Icon,
  label,
  value,
  description,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  description?: string;
  variant?: "default" | "destructive" | "warning";
}) {
  const colorClass =
    variant === "destructive"
      ? "text-destructive"
      : variant === "warning"
      ? "text-yellow-600"
      : "text-primary";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className={`p-2 rounded-md bg-muted ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold">{formatNumber(value)}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Stats display component
 */
export function StatsCards({
  stats,
  isLoading,
  onRefresh,
  syncStatus,
}: StatsCardsProps) {
  const syncComplete = syncStatus === "completed";
  if (isLoading && !stats) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Scanning your inbox...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Inbox Overview
            </CardTitle>
            <CardDescription>
              Stats calculated from synced emails
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Total emails */}
        <div className="mb-6 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{formatNumber(stats.total)}</p>
              <p className="text-muted-foreground">Total emails</p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">
            Categories
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard
              icon={Tag}
              label="Promotions"
              value={stats.categories.promotions}
              variant="destructive"
            />
            <StatCard
              icon={Users}
              label="Social"
              value={stats.categories.social}
            />
            <StatCard
              icon={Bell}
              label="Updates"
              value={stats.categories.updates}
              variant="warning"
            />
            <StatCard
              icon={MessageSquare}
              label="Forums"
              value={stats.categories.forums}
            />
            <StatCard
              icon={Inbox}
              label="Primary"
              value={stats.categories.primary}
            />
            <StatCard
              icon={MailOpen}
              label="Unread"
              value={stats.unread}
              variant="warning"
            />
          </div>
        </div>

        {/* Size & Age - Only show when sync is complete */}
        {syncComplete ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">
                Large Emails
              </h4>
              <div className="space-y-3">
                <StatCard
                  icon={HardDrive}
                  label="> 5 MB"
                  value={stats.size.larger5MB}
                />
                <StatCard
                  icon={HardDrive}
                  label="> 10 MB"
                  value={stats.size.larger10MB}
                  variant="destructive"
                />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">
                Old Emails
              </h4>
              <div className="space-y-3">
                <StatCard
                  icon={Calendar}
                  label="> 1 Year"
                  value={stats.age.olderThan1Year}
                />
                <StatCard
                  icon={Calendar}
                  label="> 2 Years"
                  value={stats.age.olderThan2Years}
                  variant="warning"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg border bg-muted/30 text-center">
            <p className="text-sm text-muted-foreground">
              Large emails and old emails stats will be available after sync completes
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
