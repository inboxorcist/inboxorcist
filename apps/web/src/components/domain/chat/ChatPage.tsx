import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { EmailTableEmbed } from './EmailTableEmbed'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorName,
} from '@/components/ai-elements/model-selector'
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
} from '@/components/ai-elements/chain-of-thought'
import { Loader } from '@/components/ai-elements/loader'
import {
  MessageSquare,
  Plus,
  Trash2,
  Wand2,
  ChevronDown,
  History,
  BarChart3,
  Mail,
  Trash,
  Filter,
  Search,
  Tag,
  Bell,
  FileText,
  BrainIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'
import {
  getChatConfig,
  saveChatConfig,
  getConversations,
  createConversation,
  getConversation,
  deleteConversation,
  sendChatMessage,
  executeActionWithStream,
  type AIConfig,
  type ChatConversation,
  type ChatMessage,
  type AIProviderType,
} from '@/lib/api'

interface ChatPageProps {
  accountId: string
  initialConversationId?: string
  onConversationChange?: (conversationId: string | null) => void
}

// Helper to format bytes to human readable size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

// Parse content for <email-table queryId="..." /> tags
type ContentSegment = { type: 'text'; content: string } | { type: 'email-table'; queryId: string }

function parseContentWithEmailTables(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  // Match <email-table queryId="..." /> (with optional whitespace and attributes)
  const emailTableRegex = /<email-table\s+queryId=["']([^"']+)["']\s*\/>/g

  let lastIndex = 0
  let match

  while ((match = emailTableRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim()
      if (textContent) {
        segments.push({ type: 'text', content: textContent })
      }
    }
    // Add the email-table segment
    segments.push({ type: 'email-table', queryId: match[1] })
    lastIndex = match.index + match[0].length
  }

  // Add remaining text after last match
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim()
    if (textContent) {
      segments.push({ type: 'text', content: textContent })
    }
  }

  // If no matches found, return the whole content as text
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: 'text', content })
  }

  return segments
}

// Quick prompt suggestions for empty state (translation keys)
const QUICK_PROMPTS = [
  {
    icon: BarChart3,
    titleKey: 'bishop.prompt.overview' as const,
    promptKey: 'bishop.prompt.overview.text' as const,
  },
  {
    icon: Mail,
    titleKey: 'bishop.prompt.topSenders' as const,
    promptKey: 'bishop.prompt.topSenders.text' as const,
  },
  {
    icon: Trash,
    titleKey: 'bishop.prompt.cleanup' as const,
    promptKey: 'bishop.prompt.cleanup.text' as const,
  },
  {
    icon: Filter,
    titleKey: 'bishop.prompt.subscriptions' as const,
    promptKey: 'bishop.prompt.subscriptions.text' as const,
  },
]

type ChatStatus = 'idle' | 'submitted' | 'streaming' | 'error'

interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  provider?: string
  model?: string
  toolCalls?: Array<{
    toolCallId: string
    toolName: string
    args: unknown
  }>
  toolResults?: Array<{
    toolCallId: string
    toolName: string
    result: unknown
  }>
  approvalState?: Array<{
    approvalId: string
    toolName: string
    args: unknown
  }>
}

// Custom confirmation from tool result
interface PendingActionConfirmation {
  id: string
  toolCallId: string // Track which tool call this is for
  toolName: string // The actual tool name from the AI
  action: 'delete' | 'trash' | 'createFilter'
  count?: number
  totalSize?: number
  totalSizeFormatted?: string
  filterDescription?: string
  filters: Record<string, unknown>
  description: string
  warning: string
  details?: {
    criteria?: string
    action?: string
  }
}

export function ChatPage({
  accountId,
  initialConversationId,
  onConversationChange,
}: ChatPageProps) {
  const { t } = useLanguage()

  // AI Configuration state
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  // Setup form state
  const [setupProvider, setSetupProvider] = useState<AIProviderType>('openai')
  const [setupApiKey, setSetupApiKey] = useState('')
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  // Conversation state
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversationId ?? null
  )
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [pendingActionConfirmation, setPendingActionConfirmation] =
    useState<PendingActionConfirmation | null>(null)
  const [actionExecuting, setActionExecuting] = useState(false)

  // Model selection - defaults are set from config in useEffect
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)

  // Abort controller for canceling requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Track if we're actively sending a message (to prevent message overwrite from loading)
  const isSendingRef = useRef(false)

  // Ref for auto-scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load AI config on mount
  useEffect(() => {
    loadConfig()
  }, [])

  // Load conversations when config is ready and account changes
  useEffect(() => {
    if (config?.isConfigured && accountId) {
      loadConversations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConversations is stable, only trigger on config/account change
  }, [config?.isConfigured, accountId])

  // Load conversation messages when selected
  useEffect(() => {
    if (selectedConversationId) {
      loadConversationMessages(selectedConversationId)
    } else {
      setMessages([])
    }
  }, [selectedConversationId])

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, status])

  // Sync URL with conversation ID
  useEffect(() => {
    onConversationChange?.(selectedConversationId)
  }, [selectedConversationId, onConversationChange])

  // Set default model from config
  useEffect(() => {
    if (!config) return

    // If config has explicit defaults, use them
    if (config.defaultProvider && config.defaultModel) {
      setSelectedProvider(config.defaultProvider as AIProviderType)
      setSelectedModel(config.defaultModel)
      return
    }

    // Otherwise, find first configured provider and use its recommended model
    const configuredProvider = config.providers.find((p) => p.hasApiKey)
    if (configuredProvider) {
      const recommendedModel =
        configuredProvider.models.find((m) => m.recommended) || configuredProvider.models[0]
      setSelectedProvider(configuredProvider.id as AIProviderType)
      setSelectedModel(recommendedModel?.id || configuredProvider.models[0]?.id)
    }
  }, [config])

  const loadConfig = async () => {
    setConfigLoading(true)
    setConfigError(null)
    try {
      const data = await getChatConfig()
      setConfig(data)
    } catch (err) {
      setConfigError('Failed to load AI configuration')
      console.error('Failed to load AI config:', err)
    } finally {
      setConfigLoading(false)
    }
  }

  const loadConversations = async () => {
    setConversationsLoading(true)
    try {
      const data = await getConversations(accountId)
      setConversations(data)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setConversationsLoading(false)
    }
  }

  const loadConversationMessages = async (conversationId: string) => {
    // Don't load messages if we're actively sending - it would overwrite optimistic updates
    if (isSendingRef.current) return
    try {
      const data = await getConversation(conversationId)
      // Double-check we're still not sending after the network request
      if (isSendingRef.current) return
      setMessages(
        data.messages.map((msg: ChatMessage) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          provider: msg.provider,
          model: msg.model,
          toolCalls: msg.toolCalls,
          toolResults: msg.toolResults,
          approvalState: msg.approvalState,
        }))
      )
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  }

  const handleSaveConfig = async () => {
    if (!setupApiKey.trim()) {
      setSetupError('Please enter an API key')
      return
    }

    setSetupSaving(true)
    setSetupError(null)
    try {
      await saveChatConfig(setupProvider, setupApiKey.trim(), true)
      setSetupApiKey('')
      await loadConfig()
    } catch (err) {
      setSetupError('Failed to save configuration')
      console.error('Failed to save AI config:', err)
    } finally {
      setSetupSaving(false)
    }
  }

  const handleNewConversation = () => {
    // Clear state to start fresh - conversation will be created when user sends first message
    setSelectedConversationId(null)
    setMessages([])
    setPendingActionConfirmation(null)
    setHistoryDrawerOpen(false)
  }

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId)
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null)
        setMessages([])
        setPendingActionConfirmation(null)
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId)
    setHistoryDrawerOpen(false)
  }

  const handleSendMessage = useCallback(
    async ({ text }: { text: string }) => {
      if (!text.trim() || status !== 'idle' || !selectedProvider || !selectedModel) return

      // Mark that we're sending to prevent message reload from overwriting
      isSendingRef.current = true

      // Create conversation if needed
      let conversationId = selectedConversationId
      if (!conversationId) {
        try {
          const conversation = await createConversation(accountId)
          conversationId = conversation.id
          setConversations((prev) => [conversation, ...prev])
          setSelectedConversationId(conversationId)
        } catch (err) {
          console.error('Failed to create conversation:', err)
          return
        }
      }

      // Add user message optimistically
      const userMessage: UIMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        provider: selectedProvider,
        model: selectedModel,
      }
      setMessages((prev) => [...prev, userMessage])
      setStatus('submitted')
      setPendingActionConfirmation(null)

      // Create abort controller
      abortControllerRef.current = new AbortController()

      try {
        // Prepare for assistant message - create ID outside to use in callbacks
        const assistantMessageId = `temp-assistant-${Date.now()}`
        const assistantMessage: UIMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          provider: selectedProvider,
          model: selectedModel,
          toolCalls: [],
          toolResults: [],
        }
        setMessages((prev) => [...prev, assistantMessage])
        setStatus('streaming')

        // Stream the response
        await sendChatMessage(conversationId, text, selectedProvider, selectedModel, {
          onText: (chunk) => {
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === assistantMessageId)
              if (idx === -1) return prev
              const updated = [...prev]
              updated[idx] = {
                ...updated[idx],
                content: updated[idx].content + chunk,
              }
              return updated
            })
          },
          onToolCall: (toolCall) => {
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === assistantMessageId)
              if (idx === -1) return prev
              // Deduplicate by toolCallId
              const existingToolCalls = prev[idx].toolCalls || []
              if (existingToolCalls.some((tc) => tc.toolCallId === toolCall.toolCallId)) {
                return prev
              }
              const updated = [...prev]
              updated[idx] = {
                ...updated[idx],
                toolCalls: [...existingToolCalls, toolCall],
              }
              return updated
            })
          },
          onToolResult: (toolResult) => {
            // Check if this is a confirmation request - if so, DON'T add to toolResults
            // The tool should NOT show as "Completed" until user confirms
            let result = toolResult.result as Record<string, unknown>
            if (result?.type === 'json' && result.value) {
              result = result.value as Record<string, unknown>
            }
            if (result?.confirmation_required === true) {
              // Don't add to toolResults - will be handled by onConfirmationNeeded
              return
            }

            // Add small delay to allow React to render the "running" state first
            // This prevents React from batching tool-call and tool-result updates together
            setTimeout(() => {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantMessageId)
                if (idx === -1) return prev
                const updated = [...prev]
                updated[idx] = {
                  ...updated[idx],
                  toolResults: [...(updated[idx].toolResults || []), toolResult],
                }
                return updated
              })
            }, 100)
          },
          onConfirmationNeeded: (confirmation) => {
            // Set the pending confirmation - stream will pause after this
            // Tool will show as "Awaiting approval" since we didn't add result to toolResults
            setPendingActionConfirmation({
              id: `action-${Date.now()}`,
              toolCallId: confirmation.toolCallId,
              toolName: confirmation.toolName, // Store actual tool name from AI
              action: confirmation.action,
              count: confirmation.count,
              totalSize: confirmation.totalSize,
              totalSizeFormatted: confirmation.totalSizeFormatted,
              filterDescription: confirmation.filterDescription,
              filters: confirmation.filters,
              description: confirmation.description,
              warning: confirmation.warning,
              details: confirmation.details,
            })
          },
          onConfirmationPaused: () => {
            // Stream paused waiting for confirmation - update status but don't call onDone
            isSendingRef.current = false
            setStatus('idle')
            // Reload conversations to get updated title
            loadConversations()
          },
          onDone: () => {
            isSendingRef.current = false
            setStatus('idle')
            // Reload conversations to get updated title
            loadConversations()
          },
          onError: (error) => {
            console.error('Chat streaming error:', error)
            isSendingRef.current = false
            setStatus('error')
          },
          signal: abortControllerRef.current.signal,
        })
      } catch (err) {
        console.error('Failed to send message:', err)
        isSendingRef.current = false
        setStatus('error')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConversations is stable
    },
    [accountId, selectedConversationId, selectedProvider, selectedModel, status]
  )

  // Handle action confirmation (custom approval flow with AI continuation)
  const handleActionConfirmation = useCallback(
    async (confirmed: boolean) => {
      if (
        !pendingActionConfirmation ||
        !selectedConversationId ||
        !selectedProvider ||
        !selectedModel
      )
        return

      const confirmation = pendingActionConfirmation
      setPendingActionConfirmation(null)

      if (!confirmed) {
        // Call the endpoint with confirmed=false to save the cancelled result
        try {
          await executeActionWithStream(
            accountId,
            {
              action: confirmation.action,
              filters: confirmation.filters,
              conversationId: selectedConversationId,
              toolCallId: confirmation.toolCallId,
              toolName: confirmation.toolName,
              provider: selectedProvider,
              model: selectedModel,
              confirmed: false,
            },
            {
              onDone: () => {
                // Update the local message with the cancelled tool result
                setMessages((prev) => {
                  const msgIdx = prev.findIndex((m) =>
                    m.toolCalls?.some((tc) => tc.toolCallId === confirmation.toolCallId)
                  )
                  if (msgIdx === -1) return prev

                  const updated = [...prev]
                  updated[msgIdx] = {
                    ...updated[msgIdx],
                    toolResults: [
                      ...(updated[msgIdx].toolResults || []),
                      {
                        toolCallId: confirmation.toolCallId,
                        toolName: confirmation.toolName,
                        result: { cancelled: true, message: 'Action cancelled by user' },
                      },
                    ],
                  }
                  return updated
                })
              },
              onError: (error) => {
                console.error('Cancel action error:', error)
              },
            }
          )
        } catch (err) {
          console.error('Failed to cancel action:', err)
        }
        return
      }

      // Execute the action and stream AI response
      setActionExecuting(true)
      setStatus('streaming')

      // Create a new assistant message to stream the AI response into
      const assistantMessageId = `temp-assistant-${Date.now()}`
      const assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        provider: selectedProvider,
        model: selectedModel,
        toolCalls: [],
        toolResults: [],
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        await executeActionWithStream(
          accountId,
          {
            action: confirmation.action,
            filters: confirmation.filters,
            conversationId: selectedConversationId,
            toolCallId: confirmation.toolCallId,
            toolName: confirmation.toolName, // Use actual tool name from AI
            provider: selectedProvider,
            model: selectedModel,
          },
          {
            onText: (chunk) => {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantMessageId)
                if (idx === -1) return prev
                const updated = [...prev]
                updated[idx] = {
                  ...updated[idx],
                  content: updated[idx].content + chunk,
                }
                return updated
              })
            },
            onToolResult: (toolResult) => {
              // Update the previous message's tool result (the one that was awaiting approval)
              setMessages((prev) => {
                // Find the message with the tool call that was awaiting approval
                const msgIdx = prev.findIndex((m) =>
                  m.toolCalls?.some((tc) => tc.toolCallId === toolResult.toolCallId)
                )
                if (msgIdx === -1) return prev

                const updated = [...prev]
                updated[msgIdx] = {
                  ...updated[msgIdx],
                  toolResults: [...(updated[msgIdx].toolResults || []), toolResult],
                }
                return updated
              })
            },
            onDone: () => {
              setActionExecuting(false)
              setStatus('idle')
              loadConversations()
            },
            onError: (error) => {
              console.error('Action execution error:', error)
              setActionExecuting(false)
              setStatus('error')
            },
          }
        )
      } catch (err) {
        console.error('Failed to execute action:', err)
        const errorMessage: UIMessage = {
          id: `temp-error-${Date.now()}`,
          role: 'assistant',
          content: `❌ **Error:** ${err instanceof Error ? err.message : 'Failed to execute action'}`,
        }
        setMessages((prev) => [...prev, errorMessage])
        setActionExecuting(false)
        setStatus('idle')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConversations is stable
    },
    [pendingActionConfirmation, accountId, selectedConversationId, selectedProvider, selectedModel]
  )

  // Get current model name for display
  const getCurrentModelName = () => {
    if (!selectedProvider || !selectedModel) return 'Select model'
    const provider = config?.providers.find((p) => p.id === selectedProvider)
    const model = provider?.models.find((m) => m.id === selectedModel)
    return model?.name || selectedModel
  }

  // Loading state
  if (configLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('bishop.title')}</h1>
          <p className="text-muted-foreground">{t('bishop.description')}</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader />
        </div>
      </div>
    )
  }

  // Error state
  if (configError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('bishop.title')}</h1>
          <p className="text-muted-foreground">{t('bishop.description')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative mb-8">
            <div className="absolute inset-0 blur-2xl bg-destructive/20 rounded-full scale-150" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
              <Wand2 className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-destructive mb-2">
            {t('bishop.status.error')}
          </h2>
          <p className="text-muted-foreground text-center max-w-md mb-8">{configError}</p>
          <Button onClick={loadConfig} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Unconfigured state - show setup form
  if (!config?.isConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('bishop.title')}</h1>
          <p className="text-muted-foreground">{t('bishop.description')}</p>
        </div>

        {/* Centered setup area */}
        <div className="flex flex-col items-center justify-center py-16">
          {/* Icon */}
          <div className="relative mb-8">
            <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full scale-150" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <Wand2 className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Title and description */}
          <h2 className="text-xl font-semibold mb-2">{t('bishop.setup.title')}</h2>
          <p className="text-muted-foreground text-center max-w-md mb-10">
            {t('bishop.setup.description')}
          </p>

          {/* Form */}
          <div className="w-full max-w-sm space-y-6">
            {/* Provider selector as button group style */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('bishop.setup.provider')}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(['openai', 'anthropic', 'google', 'vercel'] as const).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setSetupProvider(provider)}
                    className={cn(
                      'flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                      setupProvider === provider
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <img
                      src={`/${provider}.svg`}
                      alt={provider}
                      className={cn(
                        'h-5 w-5',
                        setupProvider === provider ? 'brightness-0 invert' : 'opacity-70'
                      )}
                    />
                    {provider === 'openai' && 'OpenAI'}
                    {provider === 'anthropic' && 'Anthropic'}
                    {provider === 'google' && 'Google'}
                    {provider === 'vercel' && 'Vercel'}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key input */}
            <div className="space-y-3">
              <Label
                htmlFor="apiKey"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                {t('bishop.setup.apiKey')}
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={t(`bishop.setup.apiKeyPlaceholder.${setupProvider}`)}
                value={setupApiKey}
                onChange={(e) => setSetupApiKey(e.target.value)}
                className="h-12 bg-muted/30 border-muted-foreground/20 focus:border-primary/50"
              />
            </div>

            {/* Error message */}
            {setupError && <p className="text-sm text-destructive">{setupError}</p>}

            {/* Submit button */}
            <Button
              size="lg"
              className="w-full h-12"
              onClick={handleSaveConfig}
              disabled={setupSaving || !setupApiKey.trim()}
            >
              {setupSaving ? (
                <>
                  <Loader className="mr-2 h-4 w-4" />
                  {t('bishop.setup.submitting')}
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  {t('bishop.setup.submit')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Handler for quick prompts
  const handleQuickPrompt = (prompt: string) => {
    handleSendMessage({ text: prompt })
  }

  // Configured state - show chat interface
  return (
    <Drawer open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen} direction="right">
      <div className="relative min-h-[calc(100vh-4rem)]">
        {/* Content area - uses natural page scroll */}
        <div className="flex flex-col gap-6 pb-48">
          {/* Header - full width */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t('bishop.title')}</h1>
              <p className="text-muted-foreground">{t('bishop.description')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewConversation}
                disabled={status !== 'idle'}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('bishop.history.new')}
              </Button>
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="mr-2 h-4 w-4" />
                  {t('bishop.history')}
                </Button>
              </DrawerTrigger>
            </div>
          </div>

          {/* Messages area */}
          <div className="space-y-6 w-full">
            {messages.length === 0 ? (
              /* Empty state with quick prompts */
              <div className="flex flex-col items-center justify-center h-full py-12 max-w-3xl mx-auto">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
                  <Wand2 className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{t('bishop.empty.title')}</h2>
                <p className="text-muted-foreground text-center mb-8 max-w-md">
                  {t('bishop.empty.description')}
                </p>
                <div className="grid grid-cols-2 gap-3 w-full">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item.titleKey}
                      onClick={() => handleQuickPrompt(t(item.promptKey))}
                      disabled={status !== 'idle' || !selectedProvider || !selectedModel}
                      className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <item.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{t(item.titleKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div key={message.id} className="space-y-4">
                    {/* User message - centered */}
                    {message.role === 'user' && message.content && (
                      <div className="max-w-3xl mx-auto">
                        <Message from="user">
                          <MessageContent>
                            <MessageResponse>{message.content}</MessageResponse>
                          </MessageContent>
                        </Message>
                      </div>
                    )}

                    {/* Tool calls - Chain of Thought style - same width as messages */}
                    {message.role === 'assistant' &&
                      message.toolCalls &&
                      message.toolCalls.length > 0 && (
                        <div className="max-w-3xl mx-auto w-full">
                          <ChainOfThought defaultOpen={true}>
                            <ChainOfThoughtHeader>{t('bishop.cot.header')}</ChainOfThoughtHeader>
                            <ChainOfThoughtContent>
                              {message.toolCalls.map((toolCall, idx) => {
                                const toolResult = message.toolResults?.find(
                                  (r) => r.toolCallId === toolCall.toolCallId
                                )
                                // Check if this tool is awaiting confirmation
                                const isAwaitingConfirmation =
                                  pendingActionConfirmation?.toolCallId === toolCall.toolCallId

                                // Check result type
                                const result = toolResult?.result as
                                  | Record<string, unknown>
                                  | undefined
                                const hasError = result?.error !== undefined
                                const hasConfirmationRequired =
                                  result?.confirmation_required === true
                                const wasCancelled = result?.cancelled === true

                                // Determine step status
                                // - pending: shouldn't happen (tool call exists means it started)
                                // - active: tool is running OR awaiting confirmation
                                // - complete: tool has result (and not a confirmation request)
                                let stepStatus: 'complete' | 'active' | 'pending' = 'active' // Default to active (running)
                                if (toolResult && !hasConfirmationRequired) {
                                  stepStatus = 'complete'
                                } else if (isAwaitingConfirmation || hasConfirmationRequired) {
                                  stepStatus = 'active' // Awaiting user action
                                }
                                // else: no result yet = tool is running = active

                                // Map tool names to icons and translation key prefixes
                                const toolConfig: Record<
                                  string,
                                  { icon: typeof Search; keyPrefix: string }
                                > = {
                                  queryEmails: {
                                    icon: Search,
                                    keyPrefix: 'bishop.cot.queryEmails',
                                  },
                                  getEmailContent: {
                                    icon: FileText,
                                    keyPrefix: 'bishop.cot.getEmailContent',
                                  },
                                  listLabels: { icon: Tag, keyPrefix: 'bishop.cot.listLabels' },
                                  listFilters: {
                                    icon: Filter,
                                    keyPrefix: 'bishop.cot.listFilters',
                                  },
                                  listSubscriptions: {
                                    icon: Bell,
                                    keyPrefix: 'bishop.cot.listSubscriptions',
                                  },
                                  analyzeInbox: {
                                    icon: BarChart3,
                                    keyPrefix: 'bishop.cot.analyzeInbox',
                                  },
                                  trashEmails: { icon: Trash, keyPrefix: 'bishop.cot.trashEmails' },
                                  deleteEmails: {
                                    icon: Trash2,
                                    keyPrefix: 'bishop.cot.deleteEmails',
                                  },
                                  createFilter: {
                                    icon: Filter,
                                    keyPrefix: 'bishop.cot.createFilter',
                                  },
                                  applyLabel: { icon: Tag, keyPrefix: 'bishop.cot.applyLabel' },
                                }

                                const cfg = toolConfig[toolCall.toolName] || {
                                  icon: Search,
                                  keyPrefix: null,
                                }
                                const Icon = cfg.icon

                                // Build label based on status and result
                                let label: string
                                if (cfg.keyPrefix) {
                                  if (wasCancelled) {
                                    label = t(
                                      `${cfg.keyPrefix}.cancelled` as Parameters<typeof t>[0]
                                    )
                                  } else if (hasError) {
                                    label = t(`${cfg.keyPrefix}.error` as Parameters<typeof t>[0])
                                  } else if (stepStatus === 'complete') {
                                    label = t(
                                      `${cfg.keyPrefix}.complete` as Parameters<typeof t>[0]
                                    )
                                  } else {
                                    label = t(`${cfg.keyPrefix}.active` as Parameters<typeof t>[0])
                                  }
                                } else {
                                  // Fallback for unknown tools
                                  label = wasCancelled
                                    ? `${toolCall.toolName} cancelled`
                                    : hasError
                                      ? `${toolCall.toolName} failed`
                                      : stepStatus === 'complete'
                                        ? toolCall.toolName
                                        : `Running ${toolCall.toolName}...`
                                }

                                // Extract relevant info from args for badges (all non-null filter values)
                                const args = toolCall.args as Record<string, unknown>
                                const badges: string[] = []

                                // queryEmails filters
                                if (args?.sender) badges.push(`from:${args.sender}`)
                                if (args?.senderEmail) badges.push(`email:${args.senderEmail}`)
                                if (args?.senderDomain) badges.push(`domain:${args.senderDomain}`)
                                if (args?.category)
                                  badges.push(
                                    String(args.category).replace('CATEGORY_', '').toLowerCase()
                                  )
                                if (args?.dateFrom) badges.push(`after:${args.dateFrom}`)
                                if (args?.dateTo) badges.push(`before:${args.dateTo}`)
                                if (args?.sizeMin)
                                  badges.push(`larger:${formatSize(args.sizeMin as number)}`)
                                if (args?.sizeMax)
                                  badges.push(`smaller:${formatSize(args.sizeMax as number)}`)
                                if (args?.search) badges.push(args.search as string)
                                if (args?.labelIds) badges.push(`label:${args.labelIds}`)
                                if (args?.hasAttachments === true) badges.push('has:attachment')
                                if (args?.hasAttachments === false) badges.push('no:attachment')
                                if (args?.isUnread === true) badges.push('is:unread')
                                if (args?.isUnread === false) badges.push('is:read')
                                if (args?.isStarred === true) badges.push('is:starred')
                                if (args?.isStarred === false) badges.push('not:starred')
                                if (args?.isImportant === true) badges.push('is:important')
                                if (args?.isImportant === false) badges.push('not:important')
                                if (args?.isTrash === true) badges.push('in:trash')
                                if (args?.isSpam === true) badges.push('in:spam')
                                if (args?.isSent === true) badges.push('is:sent')
                                if (args?.isArchived === true) badges.push('is:archived')
                                if (args?.breakdownBy) badges.push(`by:${args.breakdownBy}`)

                                // listSubscriptions filters
                                if (args?.minCount) badges.push(`min:${args.minCount} emails`)
                                if (args?.maxCount) badges.push(`max:${args.maxCount} emails`)
                                if (args?.minSize)
                                  badges.push(`larger:${formatSize(args.minSize as number)}`)
                                if (args?.maxSize)
                                  badges.push(`smaller:${formatSize(args.maxSize as number)}`)
                                if (args?.sortBy) badges.push(`sort:${args.sortBy}`)

                                // createFilter criteria
                                if (args?.from) badges.push(`from:${args.from}`)
                                if (args?.to) badges.push(`to:${args.to}`)
                                if (args?.subject) badges.push(`subject:${args.subject}`)
                                if (args?.hasAttachment === true) badges.push('has:attachment')
                                if (args?.action) badges.push(`action:${args.action}`)
                                if (args?.labelName) badges.push(`label:${args.labelName}`)

                                // analyzeInbox filters
                                if (args?.focus && args.focus !== 'all')
                                  badges.push(`focus:${args.focus}`)

                                // applyLabel filters
                                if (
                                  args?.addLabels &&
                                  Array.isArray(args.addLabels) &&
                                  args.addLabels.length > 0
                                ) {
                                  badges.push(`+${(args.addLabels as string[]).join(', ')}`)
                                }
                                if (
                                  args?.removeLabels &&
                                  Array.isArray(args.removeLabels) &&
                                  args.removeLabels.length > 0
                                ) {
                                  badges.push(`-${(args.removeLabels as string[]).join(', ')}`)
                                }

                                // Extract result info for description
                                let description: string | undefined
                                if (toolResult) {
                                  if (hasError) {
                                    description = result?.error as string
                                  } else if (
                                    result?.count !== undefined &&
                                    toolCall.toolName !== 'analyzeInbox'
                                  ) {
                                    // queryEmails result (and similar)
                                    description = `${(result.count as number).toLocaleString()} emails${result.totalSizeFormatted ? ` (${result.totalSizeFormatted})` : ''}`
                                  } else if (
                                    result?.total !== undefined &&
                                    toolCall.toolName === 'listSubscriptions'
                                  ) {
                                    // listSubscriptions result
                                    description = `${(result.total as number).toLocaleString()} subscriptions found`
                                  } else if (
                                    Array.isArray(result) &&
                                    toolCall.toolName === 'listLabels'
                                  ) {
                                    // listLabels result (array of labels)
                                    description = `${result.length} labels`
                                  } else if (
                                    Array.isArray(result) &&
                                    toolCall.toolName === 'listFilters'
                                  ) {
                                    // listFilters result (array of filters)
                                    description = `${result.length} filter rules`
                                  } else if (
                                    toolCall.toolName === 'analyzeInbox' &&
                                    result?.summary
                                  ) {
                                    // analyzeInbox result
                                    const summary = result.summary as {
                                      totalCleanupOpportunities: number
                                      totalEmailsToClean: number
                                      totalSizeFormatted: string
                                    }
                                    description = `${summary.totalCleanupOpportunities} opportunities, ${summary.totalEmailsToClean.toLocaleString()} emails (${summary.totalSizeFormatted})`
                                  } else if (result?.success) {
                                    description = (result.message as string) || 'Success'
                                  } else if (wasCancelled) {
                                    description = t('bishop.confirm.cancelledByUser')
                                  }
                                }

                                return (
                                  <ChainOfThoughtStep
                                    key={toolCall.toolCallId || idx}
                                    icon={Icon}
                                    label={label}
                                    description={description}
                                    status={hasError ? 'complete' : stepStatus}
                                  >
                                    {badges.length > 0 && (
                                      <ChainOfThoughtSearchResults>
                                        {badges.map((badge, i) => (
                                          <ChainOfThoughtSearchResult key={i}>
                                            {badge}
                                          </ChainOfThoughtSearchResult>
                                        ))}
                                      </ChainOfThoughtSearchResults>
                                    )}
                                  </ChainOfThoughtStep>
                                )
                              })}
                            </ChainOfThoughtContent>
                          </ChainOfThought>
                        </div>
                      )}

                    {/* Assistant message content - centered with max width */}
                    {message.role === 'assistant' && message.content && (
                      <div className="max-w-3xl mx-auto">
                        <Message from="assistant">
                          <MessageContent>
                            {/* Message text - parse for email-table tags */}
                            {(() => {
                              const segments = parseContentWithEmailTables(message.content)
                              return segments.map((segment, idx) => {
                                if (segment.type === 'email-table') {
                                  return (
                                    <EmailTableEmbed
                                      key={`table-${segment.queryId}-${idx}`}
                                      accountId={accountId}
                                      queryId={segment.queryId}
                                    />
                                  )
                                }
                                return (
                                  <MessageResponse key={`text-${idx}`}>
                                    {segment.content}
                                  </MessageResponse>
                                )
                              })
                            })()}
                          </MessageContent>
                        </Message>
                      </div>
                    )}
                  </div>
                ))}

                {/* Action confirmation dialog - Modern minimalist design */}
                {pendingActionConfirmation && (
                  <div
                    className={cn(
                      'rounded-xl border p-5 space-y-5',
                      pendingActionConfirmation.action === 'delete' &&
                        'border-destructive/30 bg-destructive/5',
                      pendingActionConfirmation.action === 'trash' &&
                        'border-orange-500/30 bg-orange-500/5',
                      pendingActionConfirmation.action === 'createFilter' &&
                        'border-blue-500/30 bg-blue-500/5'
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg',
                          pendingActionConfirmation.action === 'delete' && 'bg-destructive/10',
                          pendingActionConfirmation.action === 'trash' && 'bg-orange-500/10',
                          pendingActionConfirmation.action === 'createFilter' && 'bg-blue-500/10'
                        )}
                      >
                        {pendingActionConfirmation.action === 'delete' && (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                        {pendingActionConfirmation.action === 'trash' && (
                          <Trash className="h-4 w-4 text-orange-500" />
                        )}
                        {pendingActionConfirmation.action === 'createFilter' && (
                          <Filter className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <span className="font-semibold">
                        {pendingActionConfirmation.action === 'delete' &&
                          t('bishop.confirm.delete.title')}
                        {pendingActionConfirmation.action === 'trash' &&
                          t('bishop.confirm.trash.title')}
                        {pendingActionConfirmation.action === 'createFilter' &&
                          t('bishop.confirm.filter.title')}
                      </span>
                    </div>

                    {/* Stats for delete/trash - Compact inline display */}
                    {(pendingActionConfirmation.action === 'delete' ||
                      pendingActionConfirmation.action === 'trash') && (
                      <div className="flex items-center gap-6">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold tabular-nums">
                            {pendingActionConfirmation.count?.toLocaleString() || 0}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {t('bishop.confirm.emails')}
                          </span>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold tabular-nums">
                            {pendingActionConfirmation.totalSizeFormatted || '0 B'}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {t('bishop.confirm.storage')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Filter description - cleaner styling */}
                    {pendingActionConfirmation.filterDescription && (
                      <div className="text-sm text-muted-foreground">
                        {pendingActionConfirmation.filterDescription}
                      </div>
                    )}

                    {/* Show filter details for createFilter */}
                    {pendingActionConfirmation.details && (
                      <div className="space-y-1 text-sm">
                        {pendingActionConfirmation.details.criteria && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">
                              {t('bishop.confirm.criteria')}
                            </span>
                            <span>{pendingActionConfirmation.details.criteria}</span>
                          </div>
                        )}
                        {pendingActionConfirmation.details.action && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">
                              {t('bishop.confirm.action')}
                            </span>
                            <span>{pendingActionConfirmation.details.action}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Warning message - subtle */}
                    <p
                      className={cn(
                        'text-sm',
                        pendingActionConfirmation.action === 'delete' && 'text-destructive/80',
                        pendingActionConfirmation.action === 'trash' &&
                          'text-orange-600/80 dark:text-orange-400/80',
                        pendingActionConfirmation.action === 'createFilter' &&
                          'text-blue-600/80 dark:text-blue-400/80'
                      )}
                    >
                      {pendingActionConfirmation.warning}
                    </p>

                    {/* Action buttons - minimal */}
                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={() => handleActionConfirmation(false)}
                        disabled={actionExecuting}
                      >
                        {t('bishop.confirm.cancel')}
                      </Button>
                      <Button
                        variant={
                          pendingActionConfirmation.action === 'delete' ? 'destructive' : 'default'
                        }
                        className={cn(
                          'flex-1',
                          pendingActionConfirmation.action === 'trash' &&
                            'bg-orange-500 hover:bg-orange-600 text-white',
                          pendingActionConfirmation.action === 'createFilter' &&
                            'bg-blue-500 hover:bg-blue-600 text-white'
                        )}
                        onClick={() => handleActionConfirmation(true)}
                        disabled={actionExecuting}
                      >
                        {actionExecuting ? (
                          <Loader className="h-4 w-4" />
                        ) : (
                          <>
                            {pendingActionConfirmation.action === 'delete' &&
                              t('bishop.confirm.delete')}
                            {pendingActionConfirmation.action === 'trash' &&
                              t('bishop.confirm.trash')}
                            {pendingActionConfirmation.action === 'createFilter' &&
                              t('bishop.confirm.createFilter')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Simple shimmer loading indicator - only shown before chain of thought or streaming starts */}
                {(status === 'submitted' || status === 'streaming') &&
                  messages[messages.length - 1]?.role === 'assistant' &&
                  !messages[messages.length - 1]?.content &&
                  !messages[messages.length - 1]?.toolCalls?.length && (
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <BrainIcon className="size-4" />
                        <span className="relative inline-flex overflow-hidden">
                          <span className="animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent">
                            {t('bishop.status.processing')}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input Area - fixed at bottom with fade gradient */}
        <div className="fixed bottom-0 left-64 right-0 z-10">
          {/* Fade gradient */}
          <div className="h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          {/* Input container */}
          <div className="pb-6 px-12 bg-background">
            <div className="w-full max-w-3xl mx-auto bg-card rounded-lg">
              <PromptInput onSubmit={handleSendMessage}>
                <PromptInputTextarea
                  placeholder={t('bishop.input.placeholder')}
                  disabled={status !== 'idle'}
                />
                <PromptInputFooter>
                  <PromptInputTools>
                    {/* Model Selector */}
                    <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                      <ModelSelectorTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                          {selectedProvider && <ModelSelectorLogo provider={selectedProvider} />}
                          <span className="text-muted-foreground">{getCurrentModelName()}</span>
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </ModelSelectorTrigger>
                      <ModelSelectorContent>
                        <ModelSelectorInput placeholder="Search models..." />
                        <ModelSelectorList>
                          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                          {config?.providers
                            .filter((p) => p.hasApiKey)
                            .map((provider) => (
                              <ModelSelectorGroup key={provider.id} heading={provider.name}>
                                {provider.models.map((model) => (
                                  <ModelSelectorItem
                                    key={model.id}
                                    value={model.id}
                                    onSelect={() => {
                                      setSelectedProvider(provider.id as AIProviderType)
                                      setSelectedModel(model.id)
                                      setModelSelectorOpen(false)
                                    }}
                                  >
                                    <ModelSelectorLogo provider={provider.id} />
                                    <ModelSelectorName>
                                      {model.name}
                                      {model.recommended && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          (Recommended)
                                        </span>
                                      )}
                                    </ModelSelectorName>
                                  </ModelSelectorItem>
                                ))}
                              </ModelSelectorGroup>
                            ))}
                        </ModelSelectorList>
                      </ModelSelectorContent>
                    </ModelSelector>
                  </PromptInputTools>
                  <PromptInputSubmit
                    status={status === 'idle' ? undefined : status}
                    disabled={
                      status !== 'idle' ||
                      pendingActionConfirmation !== null ||
                      actionExecuting ||
                      !selectedProvider ||
                      !selectedModel
                    }
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>
      </div>

      {/* History Drawer Content */}
      <DrawerContent className="w-80 h-full flex flex-col">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>{t('bishop.history.title')}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 shrink-0">
          <Button className="w-full" variant="outline" onClick={handleNewConversation}>
            <Plus className="mr-2 h-4 w-4" />
            {t('bishop.history.new')}
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0 px-4">
          <div className="space-y-1 pb-4">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('bishop.history.empty')}
              </p>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
                    selectedConversationId === conversation.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => handleSelectConversation(conversation.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">
                    {conversation.title || 'New conversation'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity',
                      selectedConversationId === conversation.id
                        ? 'text-primary-foreground hover:bg-primary-foreground/20'
                        : 'hover:bg-destructive/10 hover:text-destructive'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteConversation(conversation.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
