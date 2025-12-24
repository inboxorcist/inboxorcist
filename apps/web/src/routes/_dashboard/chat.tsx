import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChatPage } from '@/components/domain/chat/ChatPage'
import { useAppContext } from '../__root'
import { useCallback } from 'react'

interface ChatSearchParams {
  conversationId?: string
}

export const Route = createFileRoute('/_dashboard/chat')({
  validateSearch: (search: Record<string, unknown>): ChatSearchParams => {
    return {
      conversationId: typeof search.conversationId === 'string' ? search.conversationId : undefined,
    }
  },
  component: ChatRoute,
})

function ChatRoute() {
  const { selectedAccountId } = useAppContext()
  const { conversationId } = Route.useSearch()
  const navigate = useNavigate()

  const onConversationChange = useCallback(
    (newConversationId: string | null) => {
      navigate({
        to: '/chat',
        search: newConversationId ? { conversationId: newConversationId } : {},
        replace: true,
      })
    },
    [navigate]
  )

  if (!selectedAccountId) {
    return null
  }

  return (
    <ChatPage
      accountId={selectedAccountId}
      initialConversationId={conversationId}
      onConversationChange={onConversationChange}
    />
  )
}
