import { createFileRoute } from '@tanstack/react-router'
import { FilterEditorPage } from '@/components/domain/filters/FilterEditorPage'
import { useAppContext } from '@/routes/__root'

export const Route = createFileRoute('/_dashboard/filters/new')({
  component: NewFilterRoute,
})

function NewFilterRoute() {
  const { selectedAccountId } = useAppContext()

  if (!selectedAccountId) {
    return null
  }

  return <FilterEditorPage accountId={selectedAccountId} />
}
