import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Filter, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getFilters, deleteFilter, applyFilter, getLabels, type GmailFilter } from '@/lib/api'
import { FilterCard } from './FilterCard'
import { useLanguage } from '@/hooks/useLanguage'

interface FilterListProps {
  accountId: string
}

export function FilterList({ accountId }: FilterListProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // State for dialogs
  const [filterToDelete, setFilterToDelete] = useState<GmailFilter | null>(null)
  const [applyingFilterId, setApplyingFilterId] = useState<string | null>(null)

  // Fetch labels first (for label name lookup)
  const { data: labelsData } = useQuery({
    queryKey: ['labels', accountId],
    queryFn: () => getLabels(accountId),
  })

  // Create a map of label ID -> label for quick lookup
  const labelsMap = new Map(
    [...(labelsData?.userLabels || []), ...(labelsData?.systemLabels || [])].map((label) => [
      label.id,
      label,
    ])
  )

  // Fetch filters
  const { data, isLoading, error } = useQuery({
    queryKey: ['filters', accountId],
    queryFn: () => getFilters(accountId),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (filterId: string) => deleteFilter(accountId, filterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters', accountId] })
      toast.success(t('filters.deleted'))
      setFilterToDelete(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('filters.error.delete'))
    },
  })

  // Apply filter mutation
  const applyMutation = useMutation({
    mutationFn: (filterId: string) => applyFilter(accountId, filterId),
    onSuccess: (result) => {
      toast.success(result.message)
      setApplyingFilterId(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('filters.error.apply'))
      setApplyingFilterId(null)
    },
  })

  // Handlers
  const handleEdit = (filter: GmailFilter) => {
    navigate({ to: '/filters/$filterId', params: { filterId: filter.id } })
  }

  const handleDelete = (filter: GmailFilter) => {
    setFilterToDelete(filter)
  }

  const handleApply = (filter: GmailFilter) => {
    setApplyingFilterId(filter.id)
    applyMutation.mutate(filter.id)
  }

  const confirmDelete = () => {
    if (filterToDelete) {
      deleteMutation.mutate(filterToDelete.id)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('filters.error.load')}</AlertDescription>
      </Alert>
    )
  }

  const filters = data?.filters || []

  return (
    <>
      {filters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Filter className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">{t('filters.empty.title')}</h3>
          <p className="text-muted-foreground max-w-sm mb-4">{t('filters.empty.description')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filters.map((filter) => (
            <FilterCard
              key={filter.id}
              filter={filter}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onApply={handleApply}
              isApplying={applyingFilterId === filter.id}
              labelsMap={labelsMap}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!filterToDelete} onOpenChange={() => setFilterToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('filters.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('filters.delete.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          {filterToDelete && (
            <div className="my-4 p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Filter criteria:</p>
              <div className="text-muted-foreground">
                {filterToDelete.criteria.from && <p>From: {filterToDelete.criteria.from}</p>}
                {filterToDelete.criteria.to && <p>To: {filterToDelete.criteria.to}</p>}
                {filterToDelete.criteria.subject && (
                  <p>Subject: {filterToDelete.criteria.subject}</p>
                )}
                {filterToDelete.criteria.query && <p>Has: {filterToDelete.criteria.query}</p>}
                {filterToDelete.criteria.hasAttachment && <p>Has attachment</p>}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.deleting')}
                </>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
