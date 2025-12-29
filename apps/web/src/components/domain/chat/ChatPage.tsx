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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  saveChatDefaults,
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
  type ThinkingConfig,
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

// Parse content for <email-table queryId="..." title="..." /> tags
type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'email-table'; queryId: string; title?: string }

function parseContentWithEmailTables(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  // Match <email-table queryId="..." title="..." /> (with optional title attribute)
  const emailTableRegex =
    /<email-table\s+queryId=["']([^"']+)["'](?:\s+title=["']([^"']+)["'])?\s*\/>/g

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
    // Add the email-table segment with optional title
    segments.push({ type: 'email-table', queryId: match[1], title: match[2] })
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

// Step types for ordered display (reasoning, tool calls, and text interleaved)
type ReasoningStep = { type: 'reasoning'; content: string }
type ToolCallStep = { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
type TextStep = { type: 'text'; content: string }
type Step = ReasoningStep | ToolCallStep | TextStep

// Collapsible reasoning component - minimized by default
function ReasoningCollapsible({
  label,
  content,
  isActive: _isActive,
}: {
  label: string
  content: string
  isActive: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 hover:text-foreground transition-colors">
        <span>{label}</span>
        <ChevronDown
          className={cn('size-3.5 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
        <MessageResponse>{content}</MessageResponse>
      </CollapsibleContent>
    </Collapsible>
  )
}

// Group consecutive reasoning/tool-call steps into CoT groups, keeping text separate
type StepGroup =
  | { type: 'cot'; steps: (ReasoningStep | ToolCallStep)[] }
  | { type: 'text'; content: string }

function groupSteps(steps: Step[]): StepGroup[] {
  const groups: StepGroup[] = []
  let currentCotSteps: (ReasoningStep | ToolCallStep)[] = []

  for (const step of steps) {
    if (step.type === 'text') {
      // Flush any pending CoT steps
      if (currentCotSteps.length > 0) {
        groups.push({ type: 'cot', steps: currentCotSteps })
        currentCotSteps = []
      }
      groups.push({ type: 'text', content: step.content })
    } else {
      // Reasoning or tool-call - accumulate
      currentCotSteps.push(step)
    }
  }

  // Flush remaining CoT steps
  if (currentCotSteps.length > 0) {
    groups.push({ type: 'cot', steps: currentCotSteps })
  }

  return groups
}

interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  provider?: string
  model?: string
  // Ordered steps array - reasoning and tool calls in the order they occurred
  steps?: Step[]
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

  // Thinking/Reasoning state
  type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'auto'
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('off')
  const [isReasoningStreaming, setIsReasoningStreaming] = useState(false)

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

  // Set default model and thinking level from config
  useEffect(() => {
    if (!config) return

    // Set thinking level from config
    if (config.defaultThinkingLevel) {
      setThinkingLevel(config.defaultThinkingLevel as ThinkingLevel)
    }

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

  // Save default settings when user changes provider/model/thinking
  const saveDefaultSettings = async (
    provider: AIProviderType,
    model: string,
    thinking: ThinkingLevel
  ) => {
    try {
      await saveChatDefaults(provider, model, thinking)
    } catch (err) {
      console.error('Failed to save default settings:', err)
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

      const loadedMessages = data.messages.map((msg: ChatMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        provider: msg.provider,
        model: msg.model,
        steps: msg.steps as Step[] | undefined, // Ordered steps from backend
        toolCalls: msg.toolCalls,
        toolResults: msg.toolResults,
        approvalState: msg.approvalState,
      }))

      setMessages(loadedMessages)

      // Check if there's a pending confirmation to restore
      // Look for approvalState with type: 'pending' that hasn't been resolved
      for (const msg of loadedMessages) {
        if (msg.role === 'assistant' && msg.approvalState) {
          for (const approval of msg.approvalState) {
            const ap = approval as {
              type: string
              toolCallId: string
              toolName: string
              confirmationData?: Record<string, unknown>
            }
            // Check if this is a pending approval
            if (ap.type === 'pending' && ap.confirmationData) {
              const data = ap.confirmationData
              setPendingActionConfirmation({
                id: `action-restored-${Date.now()}`,
                toolCallId: ap.toolCallId,
                toolName: ap.toolName,
                action: data.action as 'delete' | 'trash' | 'createFilter',
                count: data.count as number | undefined,
                totalSize: data.totalSize as number | undefined,
                totalSizeFormatted: data.totalSizeFormatted as string | undefined,
                filterDescription: data.filterDescription as string | undefined,
                filters: (data.filters as Record<string, unknown>) || {},
                description: (data.description as string) || '',
                warning: (data.warning as string) || '',
                details: data.details as { criteria?: string; action?: string } | undefined,
              })
              return // Only restore the first pending confirmation
            }
          }
        }
      }

      // No pending confirmation found, clear any existing one
      setPendingActionConfirmation(null)
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
          steps: [], // Ordered steps (reasoning + tool calls)
          provider: selectedProvider,
          model: selectedModel,
          toolCalls: [],
          toolResults: [],
        }
        setMessages((prev) => [...prev, assistantMessage])
        setStatus('streaming')

        // Build thinking config if enabled
        // Send both reasoningEffort (OpenAI) and thinkingLevel (Gemini 3)
        // The backend will use the appropriate one based on the model
        // For models with built-in reasoning, always enable thinking
        const currentModel = config?.providers
          .find((p) => p.id === selectedProvider)
          ?.models.find((m) => m.id === selectedModel)
        const hasBuiltInReasoning = currentModel?.reasoningBuiltIn ?? false

        const effectiveLevel = thinkingLevel === 'auto' ? 'medium' : thinkingLevel
        const thinkingConfig: ThinkingConfig | undefined =
          hasBuiltInReasoning || thinkingLevel !== 'off'
            ? {
                enabled: true,
                reasoningEffort: effectiveLevel,
                thinkingLevel: effectiveLevel as 'low' | 'medium' | 'high',
              }
            : undefined

        // Reset reasoning streaming state
        if (hasBuiltInReasoning || thinkingLevel !== 'off') {
          setIsReasoningStreaming(true)
        }

        // Stream the response
        await sendChatMessage(
          conversationId,
          text,
          selectedProvider,
          selectedModel,
          {
            onReasoning: (chunk) => {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantMessageId)
                if (idx === -1) return prev
                const updated = [...prev]
                const currentSteps = [...(updated[idx].steps || [])]
                // Append to last reasoning step or create new one
                const lastStep = currentSteps[currentSteps.length - 1]
                if (lastStep?.type === 'reasoning') {
                  currentSteps[currentSteps.length - 1] = {
                    ...lastStep,
                    content: lastStep.content + chunk,
                  }
                } else {
                  currentSteps.push({ type: 'reasoning', content: chunk })
                }
                updated[idx] = {
                  ...updated[idx],
                  steps: currentSteps,
                }
                return updated
              })
            },
            onText: (chunk) => {
              // Stop reasoning streaming when text starts
              setIsReasoningStreaming(false)
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantMessageId)
                if (idx === -1) return prev
                const updated = [...prev]
                const currentSteps = [...(updated[idx].steps || [])]
                // Append to last text step or create new one
                const lastStep = currentSteps[currentSteps.length - 1]
                if (lastStep?.type === 'text') {
                  currentSteps[currentSteps.length - 1] = {
                    ...lastStep,
                    content: lastStep.content + chunk,
                  }
                } else {
                  currentSteps.push({ type: 'text', content: chunk })
                }
                updated[idx] = {
                  ...updated[idx],
                  content: updated[idx].content + chunk,
                  steps: currentSteps,
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
                const currentSteps = [...(updated[idx].steps || [])]
                // Add tool-call step to maintain order
                currentSteps.push({
                  type: 'tool-call',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                })
                updated[idx] = {
                  ...updated[idx],
                  steps: currentSteps,
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
              setIsReasoningStreaming(false)
              // Reload conversations to get updated title
              loadConversations()
            },
            onDone: () => {
              isSendingRef.current = false
              setStatus('idle')
              setIsReasoningStreaming(false)
              // Reload conversations to get updated title
              loadConversations()
            },
            onError: (error) => {
              console.error('Chat streaming error:', error)
              isSendingRef.current = false
              setStatus('error')
              setIsReasoningStreaming(false)
            },
            signal: abortControllerRef.current.signal,
          },
          thinkingConfig
        )
      } catch (err) {
        console.error('Failed to send message:', err)
        isSendingRef.current = false
        setStatus('error')
        setIsReasoningStreaming(false)
      }
    },
    [accountId, selectedConversationId, selectedProvider, selectedModel, status, thinkingLevel]
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

  // Check if current model supports thinking
  const currentModelSupportsThinking = () => {
    if (!selectedProvider || !selectedModel || !config) return false
    const provider = config.providers.find((p) => p.id === selectedProvider)
    const model = provider?.models.find((m) => m.id === selectedModel)
    return model?.supportsThinking ?? false
  }

  // Check if current model has built-in reasoning (no configurable levels)
  const currentModelHasBuiltInReasoning = () => {
    if (!selectedProvider || !selectedModel || !config) return false
    const provider = config.providers.find((p) => p.id === selectedProvider)
    const model = provider?.models.find((m) => m.id === selectedModel)
    return model?.reasoningBuiltIn ?? false
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

                    {/* Assistant message - render steps in order (CoT groups and text interleaved) */}
                    {message.role === 'assistant' &&
                      (() => {
                        // Get steps - either from steps array or fall back to toolCalls
                        const allSteps: Step[] =
                          message.steps && message.steps.length > 0
                            ? message.steps
                            : // Fallback for old messages without steps array - combine toolCalls and content
                              [
                                ...(message.toolCalls || []).map(
                                  (tc) =>
                                    ({
                                      type: 'tool-call' as const,
                                      ...tc,
                                    }) as ToolCallStep
                                ),
                                ...(message.content
                                  ? [{ type: 'text' as const, content: message.content }]
                                  : []),
                              ]

                        // Group consecutive CoT steps together
                        const groups = groupSteps(allSteps)

                        if (groups.length === 0) return null

                        return groups.map((group, groupIdx) => {
                          if (group.type === 'text') {
                            // Render text as message
                            const segments = parseContentWithEmailTables(group.content)
                            return (
                              <div key={`text-group-${groupIdx}`} className="max-w-3xl mx-auto">
                                <Message from="assistant">
                                  <MessageContent>
                                    {segments.map((segment, idx) => {
                                      if (segment.type === 'email-table') {
                                        return (
                                          <EmailTableEmbed
                                            key={`table-${segment.queryId}-${idx}`}
                                            accountId={accountId}
                                            queryId={segment.queryId}
                                            title={segment.title}
                                          />
                                        )
                                      }
                                      return (
                                        <MessageResponse key={`text-${idx}`}>
                                          {segment.content}
                                        </MessageResponse>
                                      )
                                    })}
                                  </MessageContent>
                                </Message>
                              </div>
                            )
                          }

                          // Render CoT group (reasoning + tool calls)
                          return (
                            <div key={`cot-group-${groupIdx}`} className="max-w-3xl mx-auto w-full">
                              <ChainOfThought defaultOpen={true}>
                                <ChainOfThoughtHeader>
                                  {t('bishop.cot.header')}
                                </ChainOfThoughtHeader>
                                <ChainOfThoughtContent>
                                  {group.steps.map((step, stepIdx) => {
                                    if (step.type === 'reasoning') {
                                      const isLastMessage =
                                        message.id === messages[messages.length - 1]?.id
                                      const isLastGroup = groupIdx === groups.length - 1
                                      const isLastStep = stepIdx === group.steps.length - 1
                                      const isActiveReasoning =
                                        isReasoningStreaming &&
                                        isLastMessage &&
                                        isLastGroup &&
                                        isLastStep

                                      return (
                                        <ChainOfThoughtStep
                                          key={`reasoning-${groupIdx}-${stepIdx}`}
                                          icon={BrainIcon}
                                          label={
                                            <ReasoningCollapsible
                                              label={
                                                isActiveReasoning
                                                  ? t('bishop.cot.reasoning.active')
                                                  : t('bishop.cot.reasoning.complete')
                                              }
                                              content={step.content}
                                              isActive={isActiveReasoning}
                                            />
                                          }
                                          description=""
                                          status={isActiveReasoning ? 'active' : 'complete'}
                                        />
                                      )
                                    }

                                    // Tool call step
                                    const toolCall = step as ToolCallStep
                                    const toolResult = message.toolResults?.find(
                                      (r) => r.toolCallId === toolCall.toolCallId
                                    )
                                    const isAwaitingConfirmation =
                                      pendingActionConfirmation?.toolCallId === toolCall.toolCallId
                                    const result = toolResult?.result as
                                      | Record<string, unknown>
                                      | undefined
                                    const hasError = result?.error !== undefined
                                    const hasConfirmationRequired =
                                      result?.confirmation_required === true
                                    const wasCancelled = result?.cancelled === true

                                    let stepStatus: 'complete' | 'active' | 'pending' = 'active'
                                    if (toolResult && !hasConfirmationRequired) {
                                      stepStatus = 'complete'
                                    } else if (isAwaitingConfirmation || hasConfirmationRequired) {
                                      stepStatus = 'active'
                                    }

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
                                      trashEmails: {
                                        icon: Trash,
                                        keyPrefix: 'bishop.cot.trashEmails',
                                      },
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

                                    let label: string
                                    if (cfg.keyPrefix) {
                                      if (wasCancelled) {
                                        label = t(
                                          `${cfg.keyPrefix}.cancelled` as Parameters<typeof t>[0]
                                        )
                                      } else if (hasError) {
                                        label = t(
                                          `${cfg.keyPrefix}.error` as Parameters<typeof t>[0]
                                        )
                                      } else if (stepStatus === 'complete') {
                                        label = t(
                                          `${cfg.keyPrefix}.complete` as Parameters<typeof t>[0]
                                        )
                                      } else {
                                        label = t(
                                          `${cfg.keyPrefix}.active` as Parameters<typeof t>[0]
                                        )
                                      }
                                    } else {
                                      label = wasCancelled
                                        ? `${toolCall.toolName} cancelled`
                                        : hasError
                                          ? `${toolCall.toolName} failed`
                                          : stepStatus === 'complete'
                                            ? toolCall.toolName
                                            : `Running ${toolCall.toolName}...`
                                    }

                                    const args = toolCall.args as Record<string, unknown>
                                    const badges: string[] = []
                                    if (args?.sender) badges.push(`from:${args.sender}`)
                                    if (args?.senderEmail) badges.push(`email:${args.senderEmail}`)
                                    if (args?.senderDomain)
                                      badges.push(`domain:${args.senderDomain}`)
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
                                    if (args?.minCount) badges.push(`min:${args.minCount} emails`)
                                    if (args?.maxCount) badges.push(`max:${args.maxCount} emails`)
                                    if (args?.minSize)
                                      badges.push(`larger:${formatSize(args.minSize as number)}`)
                                    if (args?.maxSize)
                                      badges.push(`smaller:${formatSize(args.maxSize as number)}`)
                                    if (args?.sortBy) badges.push(`sort:${args.sortBy}`)
                                    if (args?.from) badges.push(`from:${args.from}`)
                                    if (args?.to) badges.push(`to:${args.to}`)
                                    if (args?.subject) badges.push(`subject:${args.subject}`)
                                    if (args?.hasAttachment === true) badges.push('has:attachment')
                                    if (args?.action) badges.push(`action:${args.action}`)
                                    if (args?.labelName) badges.push(`label:${args.labelName}`)
                                    if (args?.focus && args.focus !== 'all')
                                      badges.push(`focus:${args.focus}`)
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

                                    let description: string | undefined
                                    if (toolResult) {
                                      if (hasError) {
                                        description = result?.error as string
                                      } else if (
                                        result?.count !== undefined &&
                                        toolCall.toolName !== 'analyzeInbox'
                                      ) {
                                        description = `${(result.count as number).toLocaleString()} emails${result.totalSizeFormatted ? ` (${result.totalSizeFormatted})` : ''}`
                                      } else if (
                                        result?.total !== undefined &&
                                        toolCall.toolName === 'listSubscriptions'
                                      ) {
                                        description = `${(result.total as number).toLocaleString()} subscriptions found`
                                      } else if (
                                        Array.isArray(result) &&
                                        toolCall.toolName === 'listLabels'
                                      ) {
                                        description = `${result.length} labels`
                                      } else if (
                                        Array.isArray(result) &&
                                        toolCall.toolName === 'listFilters'
                                      ) {
                                        description = `${result.length} filter rules`
                                      } else if (
                                        toolCall.toolName === 'analyzeInbox' &&
                                        result?.summary
                                      ) {
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
                                        key={`tool-${groupIdx}-${stepIdx}`}
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
                          )
                        })
                      })()}
                  </div>
                ))}

                {/* Action confirmation dialog - Modern minimalist design */}
                {pendingActionConfirmation && (
                  <div className="max-w-3xl mx-auto">
                    <div
                      className={cn(
                        'rounded-xl border p-5 space-y-5 bg-card',
                        pendingActionConfirmation.action === 'delete' && 'border-destructive/30',
                        pendingActionConfirmation.action === 'trash' && 'border-orange-500/30',
                        pendingActionConfirmation.action === 'createFilter' && 'border-blue-500/30'
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
                            pendingActionConfirmation.action === 'delete'
                              ? 'destructive'
                              : 'default'
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
                  </div>
                )}

                {/* Simple shimmer loading indicator - only shown before chain of thought or streaming starts */}
                {(status === 'submitted' || status === 'streaming') &&
                  messages[messages.length - 1]?.role === 'assistant' &&
                  !messages[messages.length - 1]?.content &&
                  !messages[messages.length - 1]?.steps?.length &&
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
                                      // Save default settings
                                      saveDefaultSettings(
                                        provider.id as AIProviderType,
                                        model.id,
                                        thinkingLevel
                                      )
                                    }}
                                  >
                                    <ModelSelectorLogo provider={provider.id} />
                                    <ModelSelectorName>
                                      {model.name}
                                      {model.supportsThinking && (
                                        <BrainIcon className="ml-1.5 inline-block h-3.5 w-3.5 text-muted-foreground" />
                                      )}
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

                    {/* Thinking Level Dropdown or Auto Badge */}
                    {currentModelSupportsThinking() &&
                      (currentModelHasBuiltInReasoning() ? (
                        // Show static "Auto" badge for models with built-in reasoning
                        <div className="flex h-8 items-center gap-1.5 px-2 text-sm text-primary">
                          <BrainIcon className="h-4 w-4" />
                          <span>{t('bishop.thinking.auto')}</span>
                        </div>
                      ) : (
                        // Show dropdown for models with configurable reasoning levels
                        <Select
                          value={thinkingLevel}
                          onValueChange={(value) => {
                            const newLevel = value as ThinkingLevel
                            setThinkingLevel(newLevel)
                            // Save default settings
                            if (selectedProvider && selectedModel) {
                              saveDefaultSettings(selectedProvider, selectedModel, newLevel)
                            }
                          }}
                          disabled={status !== 'idle'}
                        >
                          <SelectTrigger
                            className={cn(
                              'h-8 w-auto gap-1.5 border-none bg-transparent px-2 text-sm shadow-none',
                              thinkingLevel !== 'off' && 'text-primary'
                            )}
                          >
                            <BrainIcon className="h-4 w-4" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="off">{t('bishop.thinking.off')}</SelectItem>
                            <SelectItem value="low">{t('bishop.thinking.low')}</SelectItem>
                            <SelectItem value="medium">{t('bishop.thinking.medium')}</SelectItem>
                            <SelectItem value="high">{t('bishop.thinking.high')}</SelectItem>
                            <SelectItem value="auto">{t('bishop.thinking.auto')}</SelectItem>
                          </SelectContent>
                        </Select>
                      ))}
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
