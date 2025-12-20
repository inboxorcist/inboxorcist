import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Filter, Tags, Plus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { FilterList } from './FilterList'
import { LabelList } from './LabelList'
import { useLanguage } from '@/hooks/useLanguage'

interface FiltersPageProps {
  accountId: string
}

export function FiltersPage({ accountId }: FiltersPageProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'filters' | 'labels'>('filters')
  const [showCreateLabelDialog, setShowCreateLabelDialog] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('filters.title')}</h1>
          <p className="text-muted-foreground">{t('filters.description')}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'filters' | 'labels')}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="filters" className="gap-2">
              <Filter className="h-4 w-4" />
              {t('filters.tab.filters')}
            </TabsTrigger>
            <TabsTrigger value="labels" className="gap-2">
              <Tags className="h-4 w-4" />
              {t('filters.tab.labels')}
            </TabsTrigger>
          </TabsList>

          {/* Create Button */}
          {activeTab === 'filters' ? (
            <Button onClick={() => navigate({ to: '/filters/new' })} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('filters.createFilter')}
            </Button>
          ) : (
            <Button onClick={() => setShowCreateLabelDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('filters.createLabel')}
            </Button>
          )}
        </div>

        <TabsContent value="filters" className="mt-6">
          <FilterList accountId={accountId} />
        </TabsContent>

        <TabsContent value="labels" className="mt-6">
          <LabelList
            accountId={accountId}
            showCreateDialog={showCreateLabelDialog}
            onCreateDialogChange={setShowCreateLabelDialog}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
