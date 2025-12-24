/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Chat Routes
 *
 * Endpoints for AI chat conversations and streaming responses.
 * All routes require authentication.
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import { auth, type AuthVariables } from '../middleware/auth'
import { verifyAccountOwnership } from '../middleware/ownership'
import {
  getAIConfig,
  getAIApiKey,
  setAIApiKey,
  deleteAIApiKey,
  setDefaultAI,
  type AIProviderType,
} from '../services/config'
import { AI_PROVIDERS } from '../services/ai/models'
import {
  createEmailAgent,
  storedToModelMessages,
  type StoredMessage,
  AI_PROVIDER_IDS,
} from '../services/ai'
import { getMessageIdsByFilters, type ExplorerFilters } from '../services/emails'
import { batchDeleteMessages, trashMessages } from '../services/gmail'
import { createFilter as createGmailFilter } from '../services/filters'
import { getAccountStats } from '../services/emails'
import { logger } from '../lib/logger'

const chat = new Hono<{ Variables: AuthVariables }>()

// Apply auth middleware to all routes
chat.use('*', auth())

// ============================================================================
// AI Configuration Endpoints
// ============================================================================

/**
 * GET /api/chat/config
 * Get AI configuration (available providers, models, and current settings)
 */
chat.get('/config', async (c) => {
  const config = await getAIConfig()

  // Build provider list with available models
  const providers = await Promise.all(
    AI_PROVIDERS.map(async (provider) => {
      const hasKey = config.configuredProviders.includes(provider.id as AIProviderType)
      return {
        id: provider.id,
        name: provider.name,
        hasApiKey: hasKey,
        models: provider.models,
      }
    })
  )

  return c.json({
    providers,
    defaultProvider: config.defaultProvider,
    defaultModel: config.defaultModel,
    isConfigured: config.isConfigured,
  })
})

/**
 * POST /api/chat/config
 * Save AI provider configuration (API key)
 */
chat.post('/config', async (c) => {
  const body = await c.req.json<{
    provider: AIProviderType
    apiKey: string
    setAsDefault?: boolean
  }>()

  const { provider, apiKey, setAsDefault } = body

  if (!provider || !apiKey) {
    return c.json({ error: 'Provider and API key are required' }, 400)
  }

  // Validate provider
  if (!AI_PROVIDER_IDS.includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400)
  }

  try {
    // Save API key
    await setAIApiKey(provider, apiKey)

    // Set as default if requested or if it's the first provider
    const config = await getAIConfig()
    if (setAsDefault || !config.defaultProvider) {
      const providerConfig = AI_PROVIDERS.find((p) => p.id === provider)
      const defaultModel =
        providerConfig?.models.find((m) => m.recommended)?.id || providerConfig?.models[0]?.id
      if (defaultModel) {
        await setDefaultAI(provider, defaultModel)
      }
    }

    return c.json({ success: true })
  } catch (error) {
    logger.error('[Chat] Failed to save AI config:', error)
    return c.json({ error: 'Failed to save configuration' }, 500)
  }
})

/**
 * DELETE /api/chat/config/:provider
 * Delete an AI provider's API key
 */
chat.delete('/config/:provider', async (c) => {
  const provider = c.req.param('provider') as AIProviderType

  if (!AI_PROVIDER_IDS.includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400)
  }

  try {
    await deleteAIApiKey(provider)
    return c.json({ success: true })
  } catch (error) {
    logger.error('[Chat] Failed to delete AI config:', error)
    return c.json({ error: 'Failed to delete configuration' }, 500)
  }
})

// ============================================================================
// Conversation CRUD Endpoints
// ============================================================================

/**
 * GET /api/chat/accounts/:accountId/conversations
 * List conversations for a mail account
 */
chat.get('/accounts/:accountId/conversations', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('accountId')

  // Verify account ownership
  const account = await verifyAccountOwnership(userId, accountId)
  if (!account) {
    return c.json({ error: 'Account not found' }, 404)
  }

  // Get conversations with message count
  const conversations = await db
    .select({
      id: tables.aiChatConversations.id,
      title: tables.aiChatConversations.title,
      createdAt: tables.aiChatConversations.createdAt,
      updatedAt: tables.aiChatConversations.updatedAt,
      messageCount: sql<number>`(
        SELECT COUNT(*) FROM ${tables.aiChatMessages}
        WHERE ${tables.aiChatMessages.conversationId} = ${tables.aiChatConversations.id}
      )`,
    })
    .from(tables.aiChatConversations)
    .where(
      and(
        eq(tables.aiChatConversations.userId, userId),
        eq(tables.aiChatConversations.mailAccountId, accountId)
      )
    )
    .orderBy(desc(tables.aiChatConversations.updatedAt))

  return c.json(conversations)
})

/**
 * POST /api/chat/accounts/:accountId/conversations
 * Create a new conversation
 */
chat.post('/accounts/:accountId/conversations', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('accountId')

  // Verify account ownership
  const account = await verifyAccountOwnership(userId, accountId)
  if (!account) {
    return c.json({ error: 'Account not found' }, 404)
  }

  // Create conversation
  const [conversation] = await db
    .insert(tables.aiChatConversations)
    .values({
      userId,
      mailAccountId: accountId,
    })
    .returning()

  return c.json(conversation, 201)
})

/**
 * GET /api/chat/conversations/:id
 * Get a conversation with all its messages
 */
chat.get('/conversations/:id', async (c) => {
  const userId = c.get('userId')
  const conversationId = c.req.param('id')

  // Get conversation
  const [conversation] = await db
    .select()
    .from(tables.aiChatConversations)
    .where(
      and(
        eq(tables.aiChatConversations.id, conversationId),
        eq(tables.aiChatConversations.userId, userId)
      )
    )
    .limit(1)

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404)
  }

  // Get messages
  const messages = await db
    .select()
    .from(tables.aiChatMessages)
    .where(eq(tables.aiChatMessages.conversationId, conversationId))
    .orderBy(tables.aiChatMessages.createdAt)

  // Parse JSON fields
  const parsedMessages = messages.map((msg) => ({
    ...msg,
    toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : null,
    toolResults: msg.toolResults ? JSON.parse(msg.toolResults) : null,
    approvalState: msg.approvalState ? JSON.parse(msg.approvalState) : null,
  }))

  return c.json({
    ...conversation,
    messages: parsedMessages,
  })
})

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation
 */
chat.delete('/conversations/:id', async (c) => {
  const userId = c.get('userId')
  const conversationId = c.req.param('id')

  // Verify ownership and delete
  const result = await db
    .delete(tables.aiChatConversations)
    .where(
      and(
        eq(tables.aiChatConversations.id, conversationId),
        eq(tables.aiChatConversations.userId, userId)
      )
    )
    .returning({ id: tables.aiChatConversations.id })

  if (result.length === 0) {
    return c.json({ error: 'Conversation not found' }, 404)
  }

  return c.json({ success: true })
})

// ============================================================================
// Streaming Message Endpoint
// ============================================================================

/**
 * POST /api/chat/conversations/:id/messages
 * Send a message and stream the AI response
 */
chat.post('/conversations/:id/messages', async (c) => {
  const userId = c.get('userId')
  const conversationId = c.req.param('id')

  const body = await c.req.json<{
    content: string
    provider: AIProviderType
    model: string
  }>()

  const { content, provider, model } = body

  if (!content || !provider || !model) {
    return c.json({ error: 'Content, provider, and model are required' }, 400)
  }

  // Get conversation and verify ownership
  const [conversation] = await db
    .select()
    .from(tables.aiChatConversations)
    .where(
      and(
        eq(tables.aiChatConversations.id, conversationId),
        eq(tables.aiChatConversations.userId, userId)
      )
    )
    .limit(1)

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404)
  }

  // Get API key for provider
  const apiKey = await getAIApiKey(provider)
  if (!apiKey) {
    return c.json({ error: `No API key configured for ${provider}` }, 400)
  }

  // Save user message
  await db.insert(tables.aiChatMessages).values({
    conversationId,
    role: 'user',
    content,
    provider,
    model,
  })

  // Update conversation title if it's the first message
  if (!conversation.title) {
    const title = content.slice(0, 100) + (content.length > 100 ? '...' : '')
    const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
    await db
      .update(tables.aiChatConversations)
      .set({ title, updatedAt: now as any })
      .where(eq(tables.aiChatConversations.id, conversationId))
  }

  // Get existing messages for context
  const existingMessages = await db
    .select()
    .from(tables.aiChatMessages)
    .where(eq(tables.aiChatMessages.conversationId, conversationId))
    .orderBy(tables.aiChatMessages.createdAt)

  // Convert to ModelMessage format
  const storedMessages: StoredMessage[] = existingMessages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'tool',
    content: msg.content,
    provider: msg.provider as AIProviderType | undefined,
    model: msg.model || undefined,
    toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined,
    toolResults: msg.toolResults ? JSON.parse(msg.toolResults) : undefined,
    approvalState: msg.approvalState ? JSON.parse(msg.approvalState) : undefined,
  }))

  // Fix orphaned tool calls (tool calls without results)
  // This can happen from cancelled actions that didn't save properly, or legacy data
  for (const msg of storedMessages) {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const toolCallIds = (msg.toolCalls as any[]).map((tc: any) => tc.toolCallId)
      const toolResults = msg.toolResults || []
      const toolResultIds = (toolResults as any[]).map((tr: any) => tr.toolCallId)

      // Find tool calls without results and add placeholder results
      for (const tc of msg.toolCalls as any[]) {
        if (!toolResultIds.includes(tc.toolCallId)) {
          logger.warn(`[Chat] Adding placeholder result for orphaned tool call: ${tc.toolCallId}`)
          // Add a placeholder result so OpenAI doesn't error
          ;(toolResults as any[]).push({
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            result: { error: 'Action was interrupted or cancelled' },
          })
        }
      }

      msg.toolResults = toolResults
      logger.debug(
        `[Chat] Message toolCalls: ${JSON.stringify(toolCallIds)}, toolResults: ${JSON.stringify((msg.toolResults as any[]).map((tr: any) => tr.toolCallId))}`
      )
    }
  }

  const modelMessages = storedToModelMessages(storedMessages)
  logger.debug(
    `[Chat] Generated ${modelMessages.length} model messages from ${storedMessages.length} stored messages`
  )

  // Get account stats for context
  const accountStats = await getAccountStats(conversation.mailAccountId)

  // Create agent and stream response
  const agent = createEmailAgent({
    provider,
    model,
    apiKey,
    accountId: conversation.mailAccountId,
    accountStats,
  })

  return streamSSE(c, async (stream) => {
    let assistantContent = ''
    const toolCalls: unknown[] = []
    const toolResults: unknown[] = []
    let confirmationNeeded: {
      toolCallId: string
      toolName: string
      result: unknown
    } | null = null

    try {
      const streamResult = await agent.stream({ messages: modelMessages })

      for await (const event of streamResult.fullStream) {
        if (event.type === 'text-delta') {
          // If confirmation is needed, don't stream any more text from the AI
          // The AI will try to summarize but we want to stop that
          if (confirmationNeeded) {
            continue
          }
          assistantContent += event.text
          await stream.writeSSE({
            event: 'text',
            data: JSON.stringify({ text: event.text }),
          })
        } else if (event.type === 'tool-call') {
          // If confirmation is already needed, don't send more tool calls to frontend
          // We only handle one confirmation at a time
          if (confirmationNeeded) {
            logger.debug(
              `[Chat] Skipping tool-call (confirmation already needed): ${(event as any).toolName}`
            )
            continue
          }
          const toolEvent = event as any
          logger.debug(`[Chat] Tool call: ${toolEvent.toolName}`, {
            toolCallId: toolEvent.toolCallId,
            args: toolEvent.input,
          })
          toolCalls.push({
            toolCallId: toolEvent.toolCallId,
            toolName: toolEvent.toolName,
            args: toolEvent.input,
          })
          // Send tool-call event first so frontend shows "running" state
          await stream.writeSSE({
            event: 'tool-call',
            data: JSON.stringify({
              toolCallId: toolEvent.toolCallId,
              toolName: toolEvent.toolName,
              args: toolEvent.input,
            }),
          })
        } else if (event.type === 'tool-result') {
          const resultEvent = event as any
          const result = resultEvent.output

          logger.debug(`[Chat] Tool result raw: ${resultEvent.toolName}`, {
            toolCallId: resultEvent.toolCallId,
            resultType: typeof result,
            resultKeys: result ? Object.keys(result) : null,
            hasConfirmationRequired: result?.confirmation_required,
            hasNestedValue: result?.type === 'json' && result?.value,
          })

          // Check if this is a confirmation request
          // Handle both direct result and SDK wrapped format { type: 'json', value: {...} }
          let resultData = result
          if (resultData?.type === 'json' && resultData.value) {
            resultData = resultData.value
            logger.debug(`[Chat] Unwrapped JSON value: ${resultEvent.toolName}`, {
              hasConfirmationRequired: resultData?.confirmation_required,
            })
          }

          if (resultData?.confirmation_required === true) {
            logger.debug(`[Chat] Confirmation required for: ${resultEvent.toolName}`, {
              action: resultData.action,
              count: resultData.count,
            })
            // Store the confirmation request - we'll send it after stopping the stream
            confirmationNeeded = {
              toolCallId: resultEvent.toolCallId,
              toolName: resultEvent.toolName,
              result: resultData,
            }

            // Send the tool call info (so frontend knows which tool was called)
            await stream.writeSSE({
              event: 'tool-result',
              data: JSON.stringify({
                toolCallId: resultEvent.toolCallId,
                toolName: resultEvent.toolName,
                result: resultData,
              }),
            })

            // Send confirmation-needed event to pause the frontend
            await stream.writeSSE({
              event: 'confirmation-needed',
              data: JSON.stringify({
                toolCallId: resultEvent.toolCallId,
                toolName: resultEvent.toolName,
                ...resultData,
              }),
            })

            // Continue iterating to drain the stream, but don't process more events
            continue
          }

          logger.debug(`[Chat] Non-confirmation result for: ${resultEvent.toolName}`, {
            resultData: typeof resultData === 'object' ? Object.keys(resultData || {}) : resultData,
          })
          toolResults.push({
            toolCallId: resultEvent.toolCallId,
            toolName: resultEvent.toolName,
            result: resultEvent.output,
          })
          await stream.writeSSE({
            event: 'tool-result',
            data: JSON.stringify({
              toolCallId: resultEvent.toolCallId,
              toolName: resultEvent.toolName,
              result: resultEvent.output,
            }),
          })
        } else if (event.type === 'error') {
          logger.error('[Chat] Stream error event:', event)
        }
        // Ignore other event types (tool-call-streaming-start, tool-call-delta, step-start, step-finish, finish)
      }

      // If confirmation was needed, save partial message and end with confirmation event
      if (confirmationNeeded) {
        // Save the message with tool calls and any non-confirmation tool results
        // (e.g., if AI called queryEmails + trashEmails, save queryEmails result)
        await db.insert(tables.aiChatMessages).values({
          conversationId,
          role: 'assistant',
          content: assistantContent, // This is the content BEFORE the tool was called
          provider,
          model,
          toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
          toolResults: toolResults.length > 0 ? JSON.stringify(toolResults) : null, // Save non-confirmation results
          approvalState: JSON.stringify([
            {
              type: 'pending',
              toolCallId: confirmationNeeded.toolCallId,
              toolName: confirmationNeeded.toolName,
              confirmationData: confirmationNeeded.result,
            },
          ]),
        })

        // Update conversation timestamp
        const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
        await db
          .update(tables.aiChatConversations)
          .set({ updatedAt: now as any })
          .where(eq(tables.aiChatConversations.id, conversationId))

        // End with confirmation-paused instead of done
        await stream.writeSSE({ event: 'confirmation-paused', data: '{}' })
        return
      }

      // Get final text if needed (normal flow without confirmation)
      const finalText = await streamResult.text
      if (finalText && !assistantContent) {
        assistantContent = finalText
      }

      // Save assistant message
      await db.insert(tables.aiChatMessages).values({
        conversationId,
        role: 'assistant',
        content: assistantContent,
        provider,
        model,
        toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
        toolResults: toolResults.length > 0 ? JSON.stringify(toolResults) : null,
        approvalState: null,
      })

      // Update conversation timestamp
      const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
      await db
        .update(tables.aiChatConversations)
        .set({ updatedAt: now as any })
        .where(eq(tables.aiChatConversations.id, conversationId))

      await stream.writeSSE({ event: 'done', data: '{}' })
    } catch (error) {
      logger.error('[Chat] Streaming error:', error)
      try {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: error instanceof Error ? error.message : 'An error occurred',
          }),
        })
      } catch {
        // Failed to send error via SSE, connection likely closed
      }
    }
  })
})

// ============================================================================
// Tool Approval Endpoint
// ============================================================================

/**
 * POST /api/chat/conversations/:id/approval
 * Handle tool approval response
 */
chat.post('/conversations/:id/approval', async (c) => {
  const userId = c.get('userId')
  const conversationId = c.req.param('id')

  const body = await c.req.json<{
    approvalId: string
    approved: boolean
    reason?: string
  }>()

  const { approvalId, approved, reason } = body

  if (!approvalId || approved === undefined) {
    return c.json({ error: 'approvalId and approved are required' }, 400)
  }

  // Get conversation and verify ownership
  const [conversation] = await db
    .select()
    .from(tables.aiChatConversations)
    .where(
      and(
        eq(tables.aiChatConversations.id, conversationId),
        eq(tables.aiChatConversations.userId, userId)
      )
    )
    .limit(1)

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404)
  }

  // Get last message with approval state
  const [lastMessage] = await db
    .select()
    .from(tables.aiChatMessages)
    .where(eq(tables.aiChatMessages.conversationId, conversationId))
    .orderBy(desc(tables.aiChatMessages.createdAt))
    .limit(1)

  if (!lastMessage || !lastMessage.approvalState) {
    return c.json({ error: 'No pending approval found' }, 400)
  }

  const provider = lastMessage.provider as AIProviderType
  const model = lastMessage.model

  if (!provider || !model) {
    return c.json({ error: 'Invalid message state' }, 400)
  }

  // Get API key
  const apiKey = await getAIApiKey(provider)
  if (!apiKey) {
    return c.json({ error: `No API key configured for ${provider}` }, 400)
  }

  // Get all messages
  const existingMessages = await db
    .select()
    .from(tables.aiChatMessages)
    .where(eq(tables.aiChatMessages.conversationId, conversationId))
    .orderBy(tables.aiChatMessages.createdAt)

  // Convert to ModelMessage format
  const storedMessages: StoredMessage[] = existingMessages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'tool',
    content: msg.content,
    provider: msg.provider as AIProviderType | undefined,
    model: msg.model || undefined,
    toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined,
    toolResults: msg.toolResults ? JSON.parse(msg.toolResults) : undefined,
    approvalState: msg.approvalState ? JSON.parse(msg.approvalState) : undefined,
  }))

  const modelMessages = storedToModelMessages(storedMessages)

  // Add approval response message according to AI SDK v6 docs
  const approvalResponse: {
    type: 'tool-approval-response'
    approvalId: string
    approved: boolean
    reason?: string
  } = {
    type: 'tool-approval-response',
    approvalId,
    approved,
  }
  if (reason) {
    approvalResponse.reason = reason
  }

  modelMessages.push({
    role: 'tool',
    content: [approvalResponse],
  } as any)

  // Get account stats
  const accountStats = await getAccountStats(conversation.mailAccountId)

  // Create agent and continue
  const agent = createEmailAgent({
    provider,
    model,
    apiKey,
    accountId: conversation.mailAccountId,
    accountStats,
  })

  return streamSSE(c, async (stream) => {
    let assistantContent = ''
    const toolCalls: unknown[] = []
    const toolResults: unknown[] = []
    const pendingApprovals: unknown[] = []

    try {
      const result = await agent.stream({ messages: modelMessages })

      for await (const chunk of result.textStream) {
        assistantContent += chunk
        await stream.writeSSE({
          event: 'text',
          data: JSON.stringify({ text: chunk }),
        })
      }

      // Get final result
      const finalResult = await result.response

      // Extract tool calls and results
      for (const message of finalResult.messages) {
        if (message.role === 'assistant' && Array.isArray(message.content)) {
          for (const part of message.content) {
            if (typeof part === 'object' && 'type' in part) {
              if (part.type === 'tool-call') {
                const toolCall = part as {
                  type: 'tool-call'
                  toolCallId: string
                  toolName: string
                  args?: unknown
                }
                toolCalls.push({
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                })
                await stream.writeSSE({
                  event: 'tool-call',
                  data: JSON.stringify({
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: toolCall.args,
                  }),
                })
              }
              if (part.type === 'tool-approval-request') {
                const approval = part as unknown as {
                  type: 'tool-approval-request'
                  approvalId: string
                  toolCall: { toolName: string; args: unknown }
                }
                pendingApprovals.push({
                  approvalId: approval.approvalId,
                  toolName: approval.toolCall.toolName,
                  args: approval.toolCall.args,
                })
                await stream.writeSSE({
                  event: 'approval-request',
                  data: JSON.stringify({
                    approvalId: approval.approvalId,
                    toolName: approval.toolCall.toolName,
                    args: approval.toolCall.args,
                  }),
                })
              }
            }
          }
        }
        if (message.role === 'tool' && Array.isArray(message.content)) {
          for (const part of message.content) {
            if (typeof part === 'object' && 'type' in part && part.type === 'tool-result') {
              const toolResult = part as unknown as {
                type: 'tool-result'
                toolCallId: string
                toolName: string
                result: unknown
              }
              toolResults.push({
                toolCallId: toolResult.toolCallId,
                toolName: toolResult.toolName,
                result: toolResult.result,
              })
              await stream.writeSSE({
                event: 'tool-result',
                data: JSON.stringify({
                  toolCallId: toolResult.toolCallId,
                  toolName: toolResult.toolName,
                  result: toolResult.result,
                }),
              })
            }
          }
        }
      }

      // Get final text
      assistantContent = await result.text

      // Save new assistant message
      await db.insert(tables.aiChatMessages).values({
        conversationId,
        role: 'assistant',
        content: assistantContent,
        provider,
        model,
        toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
        toolResults: toolResults.length > 0 ? JSON.stringify(toolResults) : null,
        approvalState: pendingApprovals.length > 0 ? JSON.stringify(pendingApprovals) : null,
      })

      // Update conversation timestamp
      const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
      await db
        .update(tables.aiChatConversations)
        .set({ updatedAt: now as any })
        .where(eq(tables.aiChatConversations.id, conversationId))

      await stream.writeSSE({ event: 'done', data: '{}' })
    } catch (error) {
      logger.error('[Chat] Approval streaming error:', error)
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          error: error instanceof Error ? error.message : 'An error occurred',
        }),
      })
    }
  })
})

// ============================================================================
// Action Execution Endpoint (Custom Approval Flow with AI Continuation)
// ============================================================================

/**
 * POST /api/chat/accounts/:accountId/execute-action
 * Execute a confirmed action and continue the AI to generate a summary
 * This is the TRUE human-in-the-loop: action only executes after approval,
 * then AI sees the real result and can summarize it.
 */
chat.post('/accounts/:accountId/execute-action', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('accountId')

  // Verify account ownership
  const account = await verifyAccountOwnership(userId, accountId)
  if (!account) {
    return c.json({ error: 'Account not found' }, 404)
  }

  const body = await c.req.json<{
    action: 'delete' | 'trash' | 'createFilter' | 'applyLabel'
    filters: Record<string, unknown>
    conversationId: string
    toolCallId: string
    toolName: string
    provider: AIProviderType
    model: string
    confirmed?: boolean // If false, action is cancelled
    addLabels?: string[] // For applyLabel action
    removeLabels?: string[] // For applyLabel action
  }>()

  const {
    action,
    filters,
    conversationId,
    toolCallId,
    toolName,
    provider,
    model,
    confirmed = true,
  } = body

  if (!action || !filters || !conversationId || !toolCallId || !toolName || !provider || !model) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  // Handle cancellation - just save the cancelled result and return
  if (!confirmed) {
    logger.info(`[Chat Execute] Action cancelled by user: ${action}`)

    // Get conversation messages to update the tool result
    const existingMessages = await db
      .select()
      .from(tables.aiChatMessages)
      .where(eq(tables.aiChatMessages.conversationId, conversationId))
      .orderBy(tables.aiChatMessages.createdAt)

    // Find and update the message with this tool call
    for (const msg of existingMessages) {
      if (msg.toolCalls) {
        const toolCalls = JSON.parse(msg.toolCalls) as Array<{ toolCallId: string }>
        const hasToolCall = toolCalls.some((tc) => tc.toolCallId === toolCallId)
        if (hasToolCall) {
          const existingResults = msg.toolResults ? (JSON.parse(msg.toolResults) as unknown[]) : []
          existingResults.push({
            toolCallId,
            toolName,
            result: { cancelled: true, message: 'Action cancelled by user' },
          })

          await db
            .update(tables.aiChatMessages)
            .set({
              toolResults: JSON.stringify(existingResults),
              approvalState: null,
            })
            .where(eq(tables.aiChatMessages.id, msg.id))

          break
        }
      }
    }

    return c.json({ success: true, cancelled: true, message: 'Action cancelled' })
  }

  logger.info(`[Chat Execute] Executing action: ${action} with filters:`, filters)

  // Execute the action
  let actionResult: {
    success: boolean
    message: string
    count?: number
    failed?: number
    filterId?: string
  }

  try {
    if (action === 'delete') {
      // Filters are already in ExplorerFilters format from the tool
      const explorerFilters = filters as ExplorerFilters
      const messageIds = await getMessageIdsByFilters(accountId, explorerFilters)

      if (messageIds.length === 0) {
        actionResult = { success: true, message: 'No emails matched the criteria', count: 0 }
      } else {
        await batchDeleteMessages(accountId, messageIds)
        actionResult = {
          success: true,
          message: `Successfully permanently deleted ${messageIds.length.toLocaleString()} emails`,
          count: messageIds.length,
        }
      }
    } else if (action === 'trash') {
      // Filters are already in ExplorerFilters format from the tool
      const explorerFilters = filters as ExplorerFilters
      const messageIds = await getMessageIdsByFilters(accountId, explorerFilters)

      if (messageIds.length === 0) {
        actionResult = { success: true, message: 'No emails matched the criteria', count: 0 }
      } else {
        const trashResult = await trashMessages(accountId, messageIds)
        actionResult = {
          success: true,
          message: `Moved ${trashResult.succeeded.toLocaleString()} emails to trash${trashResult.failed > 0 ? ` (${trashResult.failed} failed)` : ''}`,
          count: trashResult.succeeded,
          failed: trashResult.failed,
        }
      }
    } else if (action === 'createFilter') {
      const filterParams = filters as {
        from?: string
        to?: string
        subject?: string
        hasAttachment?: boolean
        action: 'delete' | 'archive' | 'markRead' | 'star' | 'label'
        labelName?: string
      }

      const criteria: {
        from?: string
        to?: string
        subject?: string
        hasAttachment?: boolean
      } = {}
      if (filterParams.from) criteria.from = filterParams.from
      if (filterParams.to) criteria.to = filterParams.to
      if (filterParams.subject) criteria.subject = filterParams.subject
      if (filterParams.hasAttachment !== undefined)
        criteria.hasAttachment = filterParams.hasAttachment

      const filterAction: { removeLabelIds?: string[]; addLabelIds?: string[] } = {}

      switch (filterParams.action) {
        case 'delete':
          filterAction.addLabelIds = ['TRASH']
          break
        case 'archive':
          filterAction.removeLabelIds = ['INBOX']
          break
        case 'markRead':
          filterAction.removeLabelIds = ['UNREAD']
          break
        case 'star':
          filterAction.addLabelIds = ['STARRED']
          break
        case 'label':
          if (!filterParams.labelName) {
            return c.json({ error: 'labelName is required when action is "label"' }, 400)
          }
          filterAction.addLabelIds = [filterParams.labelName]
          break
      }

      const filter = await createGmailFilter(accountId, criteria, filterAction)
      actionResult = {
        success: true,
        message: `Created Gmail filter: ${filterParams.action} emails matching criteria`,
        filterId: filter.id,
      }
    } else if (action === 'applyLabel') {
      // Apply labels action - filters contains the query filters, addLabels/removeLabels are in body
      const explorerFilters = filters as ExplorerFilters
      const { addLabels, removeLabels } = body

      const messageIds = await getMessageIdsByFilters(accountId, explorerFilters || {})

      if (messageIds.length === 0) {
        actionResult = { success: true, message: 'No emails matched the criteria', count: 0 }
      } else {
        const { modifyLabels } = await import('../services/filters')
        const result = await modifyLabels(accountId, messageIds, {
          addLabelIds: addLabels,
          removeLabelIds: removeLabels,
        })

        const actionDescriptions: string[] = []
        if (addLabels?.length) actionDescriptions.push(`added labels: ${addLabels.join(', ')}`)
        if (removeLabels?.length)
          actionDescriptions.push(`removed labels: ${removeLabels.join(', ')}`)

        actionResult = {
          success: true,
          message: `${actionDescriptions.join(' and ')} on ${result.modified.toLocaleString()} emails${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
          count: result.modified,
          failed: result.failed,
        }
      }
    } else {
      return c.json({ error: 'Invalid action' }, 400)
    }
  } catch (error) {
    logger.error('[Chat Execute] Action error:', error)
    actionResult = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute action',
    }
  }

  logger.info(`[Chat Execute] Action completed:`, actionResult)

  // Get API key for provider
  const apiKey = await getAIApiKey(provider)
  if (!apiKey) {
    // Can't continue AI without API key - just return the result
    return c.json(actionResult)
  }

  // Get conversation to find the mail account
  const [conversation] = await db
    .select()
    .from(tables.aiChatConversations)
    .where(
      and(
        eq(tables.aiChatConversations.id, conversationId),
        eq(tables.aiChatConversations.userId, userId)
      )
    )
    .limit(1)

  if (!conversation) {
    return c.json(actionResult)
  }

  // Get existing messages
  const existingMessages = await db
    .select()
    .from(tables.aiChatMessages)
    .where(eq(tables.aiChatMessages.conversationId, conversationId))
    .orderBy(tables.aiChatMessages.createdAt)

  // Find and update the original message that has this tool call
  // This ensures the tool result is stored alongside its tool call for proper rendering
  let foundAndUpdated = false
  for (const msg of existingMessages) {
    if (msg.toolCalls) {
      const toolCalls = JSON.parse(msg.toolCalls) as Array<{ toolCallId: string }>
      const hasToolCall = toolCalls.some((tc) => tc.toolCallId === toolCallId)
      logger.info(
        `[Chat Execute] Checking message ${msg.id}, has toolCallId ${toolCallId}: ${hasToolCall}`
      )
      if (hasToolCall) {
        // Found the message with this tool call - add our result to its toolResults
        const existingResults = msg.toolResults ? (JSON.parse(msg.toolResults) as unknown[]) : []
        existingResults.push({ toolCallId, toolName, result: actionResult })
        const newToolResults = JSON.stringify(existingResults)
        logger.info(
          `[Chat Execute] Updating message ${msg.id} with new toolResults (count: ${existingResults.length})`
        )

        await db
          .update(tables.aiChatMessages)
          .set({
            toolResults: newToolResults,
            approvalState: null, // Clear the pending approval
          })
          .where(eq(tables.aiChatMessages.id, msg.id))

        // Verify the update worked
        const [verifyMsg] = await db
          .select({
            toolResults: tables.aiChatMessages.toolResults,
            approvalState: tables.aiChatMessages.approvalState,
          })
          .from(tables.aiChatMessages)
          .where(eq(tables.aiChatMessages.id, msg.id))
          .limit(1)
        logger.info(
          `[Chat Execute] After update - toolResults length: ${verifyMsg?.toolResults ? JSON.parse(verifyMsg.toolResults).length : 0}, approvalState: ${verifyMsg?.approvalState}`
        )

        foundAndUpdated = true
        break
      }
    }
  }
  if (!foundAndUpdated) {
    logger.warn(`[Chat Execute] Could not find message with toolCallId ${toolCallId} to update`)
  }

  // Refresh messages after update
  const updatedMessages = await db
    .select()
    .from(tables.aiChatMessages)
    .where(eq(tables.aiChatMessages.conversationId, conversationId))
    .orderBy(tables.aiChatMessages.createdAt)

  // Convert to ModelMessage format
  const storedMessages: StoredMessage[] = updatedMessages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'tool',
    content: msg.content,
    provider: msg.provider as AIProviderType | undefined,
    model: msg.model || undefined,
    toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined,
    toolResults: msg.toolResults ? JSON.parse(msg.toolResults) : undefined,
    approvalState: msg.approvalState ? JSON.parse(msg.approvalState) : undefined,
  }))

  const modelMessages = storedToModelMessages(storedMessages)

  // Add the tool result as a message so AI sees the real outcome
  // AI SDK v6 format: output must be { type: 'json', value: ... }
  modelMessages.push({
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: toolCallId,
        toolName: toolName,
        output: { type: 'json', value: actionResult },
      },
    ],
  } as any)

  // Get account stats for context
  const accountStats = await getAccountStats(conversation.mailAccountId)

  // Create agent and stream response so AI can summarize the result
  const agent = createEmailAgent({
    provider,
    model,
    apiKey,
    accountId: conversation.mailAccountId,
    accountStats,
  })

  return streamSSE(c, async (stream) => {
    let assistantContent = ''
    const toolCalls: unknown[] = []
    const toolResults: unknown[] = []

    // First, send the tool result so frontend can update UI
    await stream.writeSSE({
      event: 'tool-result',
      data: JSON.stringify({
        toolCallId,
        toolName,
        result: actionResult,
      }),
    })

    try {
      const streamResult = await agent.stream({ messages: modelMessages })

      for await (const event of streamResult.fullStream) {
        if (event.type === 'text-delta') {
          assistantContent += event.text
          await stream.writeSSE({
            event: 'text',
            data: JSON.stringify({ text: event.text }),
          })
        } else if (event.type === 'tool-call') {
          const toolEvent = event as any
          toolCalls.push({
            toolCallId: toolEvent.toolCallId,
            toolName: toolEvent.toolName,
            args: toolEvent.input,
          })
          await stream.writeSSE({
            event: 'tool-call',
            data: JSON.stringify({
              toolCallId: toolEvent.toolCallId,
              toolName: toolEvent.toolName,
              args: toolEvent.input,
            }),
          })
        } else if (event.type === 'tool-result') {
          const resultEvent = event as any
          toolResults.push({
            toolCallId: resultEvent.toolCallId,
            toolName: resultEvent.toolName,
            result: resultEvent.output,
          })
          await stream.writeSSE({
            event: 'tool-result',
            data: JSON.stringify({
              toolCallId: resultEvent.toolCallId,
              toolName: resultEvent.toolName,
              result: resultEvent.output,
            }),
          })
        }
      }

      // Get final text
      const finalText = await streamResult.text
      if (finalText && !assistantContent) {
        assistantContent = finalText
      }

      // Save assistant message (tool result is already saved in original message)
      await db.insert(tables.aiChatMessages).values({
        conversationId,
        role: 'assistant',
        content: assistantContent,
        provider,
        model,
        toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
        toolResults: toolResults.length > 0 ? JSON.stringify(toolResults) : null,
        approvalState: null,
      })

      // Update conversation timestamp
      const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
      await db
        .update(tables.aiChatConversations)
        .set({ updatedAt: now as any })
        .where(eq(tables.aiChatConversations.id, conversationId))

      await stream.writeSSE({ event: 'done', data: '{}' })
    } catch (error) {
      logger.error('[Chat Execute] Streaming error:', error)
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          error: error instanceof Error ? error.message : 'An error occurred',
        }),
      })
    }
  })
})

export default chat
