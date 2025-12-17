import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tag,
  Users,
  Bell,
  MessageSquare,
  Calendar,
  HardDrive,
  Clock,
  Archive,
  Trash2,
  AlertTriangle,
  MailOpen,
} from 'lucide-react'
import type { QuickStats, SyncProgress } from '@/lib/api'
import type { TranslationKey } from '@/lib/i18n'
import { useLanguage } from '@/hooks/useLanguage'
import { ExorcismCard, type ExorcismCardColor } from './ExorcismCard'
import { getCleanupPresetFilters, buildFilteredUrl } from '@/lib/filter-url'

type CleanupCategory =
  | 'promotions'
  | 'social'
  | 'updates'
  | 'forums'
  | 'old_1year'
  | 'old_2years'
  | 'large_5mb'
  | 'large_10mb'
  | 'spam'
  | 'trash'
  | 'read_promotions'

interface CleanupOption {
  id: CleanupCategory
  icon: React.ElementType
  titleKey: TranslationKey
  descKey: TranslationKey
  count: number
  sizeBytes: number
  color: ExorcismCardColor
  requiresSync?: boolean
}

interface QuickExorcismSectionProps {
  stats: QuickStats
  syncProgress: SyncProgress | null
  isSyncing?: boolean
  selectable?: boolean
  selectedCategories?: Set<CleanupCategory>
  onSelectionChange?: (categories: Set<CleanupCategory>) => void
}

function formatNumber(num: number | null | undefined): string {
  if (num == null) return '0'
  return num.toLocaleString()
}

export function QuickExorcismSection({
  stats,
  syncProgress,
  isSyncing = false,
  selectable = false,
  selectedCategories: externalSelected,
  onSelectionChange,
}: QuickExorcismSectionProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [internalSelected, setInternalSelected] = useState<Set<CleanupCategory>>(new Set())

  // Use external state if provided, otherwise use internal
  const selectedCategories = externalSelected ?? internalSelected
  const setSelectedCategories = onSelectionChange ?? setInternalSelected

  const syncComplete = syncProgress?.status === 'completed'
  const actionsDisabled = isSyncing

  // All cleanup options - use stats.cleanup for counts (excludes starred/important)
  const cleanupOptions: CleanupOption[] = [
    // Category-based cleanup
    {
      id: 'promotions',
      icon: Tag,
      titleKey: 'cleanup.promotions',
      descKey: 'cleanup.promotions.desc',
      count: stats.cleanup?.promotions?.count ?? 0,
      sizeBytes: stats.cleanup?.promotions?.size ?? 0,
      color: 'pink',
    },
    {
      id: 'social',
      icon: Users,
      titleKey: 'cleanup.social',
      descKey: 'cleanup.social.desc',
      count: stats.cleanup?.social?.count ?? 0,
      sizeBytes: stats.cleanup?.social?.size ?? 0,
      color: 'blue',
    },
    {
      id: 'updates',
      icon: Bell,
      titleKey: 'cleanup.updates',
      descKey: 'cleanup.updates.desc',
      count: stats.cleanup?.updates?.count ?? 0,
      sizeBytes: stats.cleanup?.updates?.size ?? 0,
      color: 'yellow',
    },
    {
      id: 'forums',
      icon: MessageSquare,
      titleKey: 'cleanup.forums',
      descKey: 'cleanup.forums.desc',
      count: stats.cleanup?.forums?.count ?? 0,
      sizeBytes: stats.cleanup?.forums?.size ?? 0,
      color: 'green',
    },
    // Age-based cleanup
    {
      id: 'old_2years',
      icon: Calendar,
      titleKey: 'cleanup.ancient',
      descKey: 'cleanup.ancient.desc',
      count: stats.cleanup?.olderThan2Years?.count ?? 0,
      sizeBytes: stats.cleanup?.olderThan2Years?.size ?? 0,
      color: 'orange',
      requiresSync: true,
    },
    {
      id: 'old_1year',
      icon: Clock,
      titleKey: 'cleanup.stale',
      descKey: 'cleanup.stale.desc',
      count: stats.cleanup?.olderThan1Year?.count ?? 0,
      sizeBytes: stats.cleanup?.olderThan1Year?.size ?? 0,
      color: 'purple',
      requiresSync: true,
    },
    // Size-based cleanup
    {
      id: 'large_10mb',
      icon: HardDrive,
      titleKey: 'cleanup.heavy',
      descKey: 'cleanup.heavy.desc',
      count: stats.cleanup?.larger10MB?.count ?? 0,
      sizeBytes: stats.cleanup?.larger10MB?.size ?? 0,
      color: 'cyan',
      requiresSync: true,
    },
    {
      id: 'large_5mb',
      icon: Archive,
      titleKey: 'cleanup.bloated',
      descKey: 'cleanup.bloated.desc',
      count: stats.cleanup?.larger5MB?.count ?? 0,
      sizeBytes: stats.cleanup?.larger5MB?.size ?? 0,
      color: 'indigo',
      requiresSync: true,
    },
    // Read-only promotions
    {
      id: 'read_promotions',
      icon: MailOpen,
      titleKey: 'cleanup.readPromos',
      descKey: 'cleanup.readPromos.desc',
      count: stats.cleanup?.readPromotions?.count ?? 0,
      sizeBytes: stats.cleanup?.readPromotions?.size ?? 0,
      color: 'pink',
    },
    // Spam cleanup
    {
      id: 'spam',
      icon: AlertTriangle,
      titleKey: 'cleanup.spam',
      descKey: 'cleanup.spam.desc',
      count: stats.spam?.count ?? 0,
      sizeBytes: stats.spam?.sizeBytes ?? 0,
      color: 'red',
    },
    // Trash cleanup (permanent delete)
    {
      id: 'trash',
      icon: Trash2,
      titleKey: 'cleanup.trash',
      descKey: 'cleanup.trash.desc',
      count: stats.trash?.count ?? 0,
      sizeBytes: stats.trash?.sizeBytes ?? 0,
      color: 'gray',
    },
  ]

  const toggleCategory = (id: CleanupCategory) => {
    const next = new Set(selectedCategories)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedCategories(next)
  }

  const totalSelected = cleanupOptions
    .filter((opt) => selectedCategories.has(opt.id))
    .reduce((sum, opt) => sum + opt.count, 0)

  const hasSelection = selectedCategories.size > 0

  // Navigate to explorer page with appropriate filter and auto-select all
  // Using router.history.push to bypass TanStack Router's JSON serialization of search params
  const navigateToExplorer = (categoryId: CleanupCategory) => {
    const filters = getCleanupPresetFilters(categoryId)
    const url = buildFilteredUrl('/explorer', filters) + '&selectAll=true'
    router.history.push(url)
  }

  const handleCardClick = (option: CleanupOption, isDisabled: boolean) => {
    if (isDisabled) return

    if (selectable) {
      toggleCategory(option.id)
    } else {
      // Navigate to explorer with filters
      navigateToExplorer(option.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Selection Summary - only show in selectable mode */}
      {selectable && hasSelection && !actionsDisabled && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Trash2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{formatNumber(totalSelected)} emails selected</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCategories.size}{' '}
                    {selectedCategories.size === 1 ? 'category' : 'categories'}
                  </p>
                </div>
              </div>
              <Button onClick={() => navigateToExplorer(Array.from(selectedCategories)[0])}>
                <Trash2 className="h-4 w-4 mr-2" />
                Begin Exorcism
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Cleanup Section - Single unified section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t('cleanup.title')}</h2>
            {actionsDisabled && (
              <Badge variant="secondary" className="text-xs">
                {t('cleanup.badge')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('cleanup.description')}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cleanupOptions.map((option) => {
            const isDisabled = actionsDisabled || !!(option.requiresSync && !syncComplete)
            return (
              <ExorcismCard
                key={option.id}
                icon={option.icon}
                title={t(option.titleKey)}
                description={t(option.descKey)}
                count={isDisabled ? '—' : option.count}
                sizeBytes={isDisabled ? undefined : option.sizeBytes}
                color={option.color}
                disabled={isDisabled}
                selected={selectable && selectedCategories.has(option.id)}
                onClick={() => handleCardClick(option, isDisabled)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export type { CleanupCategory }
