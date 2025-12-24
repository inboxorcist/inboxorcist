/**
 * AI Service Types
 *
 * Shared types for the AI agent system.
 */

import type { ModelMessage } from 'ai'

/**
 * AI Provider IDs - single source of truth
 */
export const AI_PROVIDER_IDS = ['openai', 'anthropic', 'google', 'vercel'] as const

/**
 * AI Provider type derived from the constant array
 */
export type AIProvider = (typeof AI_PROVIDER_IDS)[number]

/**
 * Account statistics for context in system prompt
 */
export interface AccountStats {
  totalEmails: number
  unread: number
  categories: {
    promotions: number
    social: number
    updates: number
    forums: number
    primary: number
  }
  totalStorageBytes: number
  uniqueSenderCount: number
}

/**
 * Agent creation options
 */
export interface CreateAgentOptions {
  provider: AIProvider
  model: string
  apiKey: string
  accountId: string
  accountStats?: AccountStats
}

/**
 * Stream chunk types for agent response
 */
export type AgentStreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolName: string; toolCallId: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'tool-approval-request'; toolName: string; toolCallId: string; args: unknown }
  | { type: 'error'; error: string }
  | { type: 'done'; finishReason: string }

/**
 * Message format for storing in database
 */
export interface StoredMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  provider?: AIProvider
  model?: string
  toolCalls?: unknown[]
  toolResults?: unknown[]
  approvalState?: unknown
}

/**
 * Convert stored messages to ModelMessage format
 *
 * AI SDK v6 ModelMessage format:
 * - user: { role: 'user', content: string }
 * - assistant: { role: 'assistant', content: string | ContentPart[] }
 *   - ToolCallPart: { type: 'tool-call', toolCallId, toolName, input }
 *   - ToolApprovalRequestPart: { type: 'tool-approval-request', approvalId, toolCall }
 * - tool: { role: 'tool', content: ToolResultPart[] | ToolApprovalResponsePart[] }
 *   - ToolResultPart: { type: 'tool-result', toolCallId, toolName, output: { type: 'json', value } }
 *   - ToolApprovalResponsePart: { type: 'tool-approval-response', approvalId, approved, reason }
 */
export function storedToModelMessages(messages: StoredMessage[]): ModelMessage[] {
  const result: ModelMessage[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content } as ModelMessage)
    } else if (msg.role === 'assistant') {
      const contentParts: unknown[] = []

      // Add text content if present
      if (msg.content) {
        contentParts.push({ type: 'text' as const, text: msg.content })
      }

      // Add tool calls
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          const toolCall = tc as { toolCallId: string; toolName: string; args: unknown }
          contentParts.push({
            type: 'tool-call' as const,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.args,
          })
        }
      }

      // Add tool-approval-request parts if there are pending approvals
      // This is crucial for the SDK to match approval responses
      if (msg.approvalState && Array.isArray(msg.approvalState) && msg.approvalState.length > 0) {
        for (const approval of msg.approvalState) {
          const ap = approval as {
            approvalId: string
            toolName: string
            args: unknown
            toolCallId?: string
          }
          // Only add approval request if we have the required fields
          if (ap.approvalId && ap.toolName) {
            contentParts.push({
              type: 'tool-approval-request' as const,
              approvalId: ap.approvalId,
              toolCall: {
                type: 'tool-call' as const,
                toolCallId: ap.toolCallId || ap.approvalId, // Use approvalId as fallback
                toolName: ap.toolName,
                input: ap.args ?? {},
              },
            })
          }
        }
      }

      if (contentParts.length > 0) {
        result.push({
          role: 'assistant',
          content: contentParts,
        } as ModelMessage)
      } else {
        result.push({ role: 'assistant', content: msg.content || '' } as ModelMessage)
      }

      // Add tool result messages for each tool call (if tool results exist)
      if (msg.toolResults && msg.toolResults.length > 0) {
        result.push({
          role: 'tool',
          content: msg.toolResults.map((tr: unknown) => {
            const toolResult = tr as { toolCallId: string; toolName: string; result: unknown }
            return {
              type: 'tool-result' as const,
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName,
              output: { type: 'json' as const, value: toolResult.result },
            }
          }),
        } as ModelMessage)
      }
    } else if (msg.role === 'tool') {
      // Tool result message (legacy format)
      if (msg.toolResults && msg.toolResults.length > 0) {
        result.push({
          role: 'tool',
          content: msg.toolResults.map((tr: unknown) => {
            const toolResult = tr as { toolCallId: string; toolName: string; result: unknown }
            return {
              type: 'tool-result' as const,
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName,
              output: { type: 'json' as const, value: toolResult.result },
            }
          }),
        } as ModelMessage)
      }
    }
  }

  return result
}

/**
 * Category display names mapping
 */
export const CATEGORY_NAMES: Record<string, string> = {
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_UPDATES: 'Updates',
  CATEGORY_FORUMS: 'Forums',
  CATEGORY_PERSONAL: 'Primary',
  SENT: 'Sent',
}

/**
 * Reverse category mapping (display name to category ID)
 */
export const CATEGORY_IDS: Record<string, string> = {
  promotions: 'CATEGORY_PROMOTIONS',
  social: 'CATEGORY_SOCIAL',
  updates: 'CATEGORY_UPDATES',
  forums: 'CATEGORY_FORUMS',
  primary: 'CATEGORY_PERSONAL',
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
