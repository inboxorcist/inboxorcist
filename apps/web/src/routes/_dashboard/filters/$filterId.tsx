import { createFileRoute } from '@tanstack/react-router'
import { FilterEditorPage } from '@/components/domain/filters/FilterEditorPage'
import { useAppContext } from '@/routes/__root'

export const Route = createFileRoute('/_dashboard/filters/$filterId')({
  component: EditFilterRoute,
})

function EditFilterRoute() {
  const { selectedAccountId } = useAppContext()
  const { filterId } = Route.useParams()

  if (!selectedAccountId) {
    return null
  }

  return <FilterEditorPage accountId={selectedAccountId} filterId={filterId} />
}
