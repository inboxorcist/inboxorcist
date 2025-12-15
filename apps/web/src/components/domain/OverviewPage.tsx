import { Skeleton } from '@/components/ui/skeleton'
import {
  Mail,
  Tag,
  Users,
  Users2,
  Bell,
  MessageSquare,
  HardDrive,
  Database,
  Calendar,
  MailOpen,
  Inbox,
  Crown,
} from 'lucide-react'
import type { QuickStats, SyncProgress as SyncProgressType } from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'
import { useCountUp } from '@/hooks/useCountUp'
import { QuickExorcismSection } from './QuickExorcismSection'
import { SyncStatusBar } from './SyncStatusBar'
import { SyncProgress } from './SyncProgress'
import { useNavigate } from '@tanstack/react-router'
import { getStatsCardFilters, buildFilteredUrl } from '@/lib/filter-url'
import { useAppContext } from '@/routes/__root'

function formatNumber(num: number | null | undefined): string {
  if (num == null) return '0'
  return num.toLocaleString()
}

function formatStorageSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

interface OverviewPageProps {
  accountId: string
  stats: QuickStats | null
  syncProgress: SyncProgressType | null
  syncStatus: string | null
  syncStartedAt: string | null
  syncCompletedAt: string | null
  isSyncing?: boolean
  onSyncComplete?: () => void
}

// Stat card for key metrics
interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number | string
  subtitle?: string
  color: string
  bgColor: string
  trend?: 'up' | 'down' | 'neutral'
  disabled?: boolean
  isCounting?: boolean
  onClick?: () => void
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  bgColor,
  disabled,
  isCounting,
  onClick,
}: StatCardProps) {
  const isClickable = !disabled && onClick

  const content = (
    <>
      {disabled && (
        <div className="absolute inset-0 bg-white/60 dark:bg-black/50 rounded-xl backdrop-blur-[1px]" />
      )}
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <p
        className={`text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 ${disabled ? 'opacity-60' : ''}`}
      >
        {label}
      </p>
      <div className="flex items-center gap-2">
        <p className={`text-2xl font-bold tabular-nums ${disabled ? 'opacity-60' : ''}`}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
        {isCounting && (
          <span className="relative flex h-2.5 w-2.5 group cursor-help" title="Counting...">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
          </span>
        )}
      </div>
      {subtitle && (
        <p className={`text-xs text-muted-foreground mt-1 ${disabled ? 'opacity-60' : ''}`}>
          {subtitle}
        </p>
      )}
    </>
  )

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className="relative flex flex-col p-4 rounded-xl bg-card border transition-all hover:shadow-md hover:border-primary/30 cursor-pointer text-left w-full"
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={`relative flex flex-col p-4 rounded-xl bg-card border transition-all ${disabled ? '' : 'hover:shadow-md hover:border-primary/30'}`}
    >
      {content}
    </div>
  )
}

// Animated stat card that counts up when value increases
interface AnimatedStatCardProps extends Omit<StatCardProps, 'value'> {
  value: number
  animate?: boolean
}

function AnimatedStatCard({ value, animate = false, ...props }: AnimatedStatCardProps) {
  const animatedValue = useCountUp(value, 600, animate)
  return <StatCard {...props} value={animatedValue} />
}

// Skeleton version of stat card
function StatCardSkeleton() {
  return (
    <div className="flex flex-col p-4 rounded-xl bg-card border">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-7 w-16 mb-1" />
      <Skeleton className="h-3 w-24 mt-1" />
    </div>
  )
}

// Skeleton for sync progress banner
function SyncProgressSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-3 w-24 mb-1" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-7 w-12" />
        </div>
      </div>
    </div>
  )
}

// Skeleton for quick exorcism cards
function QuickExorcismSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 rounded-xl border-2 border-transparent bg-muted/30">
            <Skeleton className="h-12 w-12 rounded-xl mb-4" />
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function OverviewPage({
  accountId,
  stats,
  syncProgress,
  syncStatus,
  syncStartedAt,
  syncCompletedAt,
  isSyncing = false,
  onSyncComplete,
}: OverviewPageProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { syncLoading, resumeSync } = useAppContext()

  // Use isSyncing prop as source of truth - sync is complete only when NOT syncing
  const syncComplete = !isSyncing

  // Navigation helper for stats cards
  const navigateToExplorer = (
    cardType: Parameters<typeof getStatsCardFilters>[0],
    extraArg?: string
  ) => {
    const { filters, allMail } = getStatsCardFilters(cardType, extraArg)
    const url = buildFilteredUrl('/explorer', filters, allMail)
    navigate({ to: url })
  }

  // Loading state - show skeleton layout while syncing without data
  if (!stats) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>

        {/* Sync Progress Skeleton */}
        <SyncProgressSkeleton />

        {/* Stats Skeleton - 2 rows of 4 cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatCardSkeleton key={`row1-${i}`} />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatCardSkeleton key={`row2-${i}`} />
          ))}
        </div>

        {/* Quick Exorcism Skeleton */}
        <QuickExorcismSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('overview.title')}</h1>
          <p className="text-muted-foreground">{t('overview.description')}</p>
        </div>
        {syncComplete && (
          <SyncStatusBar
            accountId={accountId}
            syncStartedAt={syncStartedAt}
            syncCompletedAt={syncCompletedAt}
            syncStatus={syncStatus}
            onSyncComplete={onSyncComplete}
          />
        )}
      </div>

      {/* Sync Progress Banner */}
      {isSyncing && (
        <SyncProgress
          progress={syncProgress}
          isLoading={syncLoading}
          onResume={resumeSync}
          showSkeleton={isSyncing}
        />
      )}

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedStatCard
          icon={Mail}
          label={t('stats.totalEmails')}
          value={stats.total}
          subtitle={t('stats.totalEmails.subtitle')}
          color="text-primary"
          bgColor="bg-primary/10"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('total')}
        />
        <AnimatedStatCard
          icon={MailOpen}
          label={t('stats.unread')}
          value={stats.unread}
          subtitle={
            stats.total > 0
              ? `${((stats.unread / stats.total) * 100).toFixed(1)}% of total`
              : '0% of total'
          }
          color="text-yellow-600"
          bgColor="bg-yellow-100"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('unread')}
        />
        <AnimatedStatCard
          icon={Inbox}
          label={t('stats.primary')}
          value={stats.categories.primary}
          subtitle={t('stats.primary.subtitle')}
          color="text-sky-600"
          bgColor="bg-sky-100"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('primary')}
        />
        <AnimatedStatCard
          icon={Tag}
          label={t('stats.promotions')}
          value={stats.categories.promotions}
          subtitle={t('stats.promotions.subtitle')}
          color="text-pink-600"
          bgColor="bg-pink-100"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('promotions')}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedStatCard
          icon={Users}
          label={t('stats.social')}
          value={stats.categories.social}
          subtitle={t('stats.social.subtitle')}
          color="text-blue-600"
          bgColor="bg-blue-100"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('social')}
        />
        <AnimatedStatCard
          icon={Bell}
          label={t('stats.updates')}
          value={stats.categories.updates}
          subtitle={t('stats.updates.subtitle')}
          color="text-amber-600"
          bgColor="bg-amber-100"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('updates')}
        />
        <AnimatedStatCard
          icon={MessageSquare}
          label={t('stats.forums')}
          value={stats.categories.forums}
          subtitle={t('stats.forums.subtitle')}
          color="text-emerald-600"
          bgColor="bg-emerald-100"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('forums')}
        />
        <StatCard
          icon={Users2}
          label={t('stats.uniqueSenders')}
          value={syncComplete ? formatNumber(stats.senders?.uniqueCount) : '—'}
          subtitle={
            syncComplete ? t('stats.uniqueSenders.subtitle') : t('stats.availableAfterSync')
          }
          color="text-indigo-600"
          bgColor="bg-indigo-100"
          disabled={!syncComplete}
        />
      </div>

      {/* Analysis Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Database}
          label={t('stats.totalStorage')}
          value={formatStorageSize(stats.size?.totalStorageBytes)}
          subtitle={t('stats.totalStorage.subtitle')}
          color="text-cyan-600"
          bgColor="bg-cyan-100"
          isCounting={isSyncing}
        />
        <AnimatedStatCard
          icon={HardDrive}
          label={t('stats.largeFiles')}
          value={stats.size?.larger10MB ?? 0}
          subtitle={t('stats.largeFiles.subtitle')}
          color="text-purple-600"
          bgColor="bg-purple-100"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('large')}
        />
        <AnimatedStatCard
          icon={Calendar}
          label={t('stats.oldEmails')}
          value={stats.age?.olderThan2Years ?? 0}
          subtitle={t('stats.oldEmails.subtitle')}
          color="text-orange-600"
          bgColor="bg-orange-100"
          isCounting={isSyncing}
          animate={isSyncing}
          onClick={() => navigateToExplorer('old')}
        />
        <StatCard
          icon={Crown}
          label={t('stats.topSender')}
          value={
            syncComplete && stats.senders?.topSender
              ? stats.senders.topSender.name || stats.senders.topSender.email.split('@')[0]
              : '—'
          }
          subtitle={
            syncComplete && stats.senders?.topSender
              ? `${formatNumber(stats.senders.topSender.count)} emails`
              : t('stats.availableAfterSync')
          }
          color="text-amber-600"
          bgColor="bg-amber-100"
          disabled={!syncComplete}
          onClick={
            syncComplete && stats.senders?.topSender
              ? () => navigateToExplorer('topSender', stats.senders?.topSender?.email)
              : undefined
          }
        />
      </div>

      {/* Quick Exorcism Section */}
      <QuickExorcismSection stats={stats} syncProgress={syncProgress} isSyncing={isSyncing} />
    </div>
  )
}
