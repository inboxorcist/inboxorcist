/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Agent Service
 *
 * Creates and manages AI agent instances for email management.
 * Uses Vercel AI SDK v6 with ToolLoopAgent for multi-step tool calling.
 */

import { ToolLoopAgent, stepCountIs, wrapLanguageModel, type ModelMessage } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'
import { createModelInstance } from './models'
import { buildSystemPrompt } from './prompt'
import { createTools, requiresApproval } from './tools'
import type { AIProvider, AccountStats, ThinkingConfig } from './types'
import { logger } from '../../lib/logger'
import { isDevelopment } from '../../lib/startup'

/**
 * Check if a model is Gemini 3 (uses thinkingLevel) vs Gemini 2.5 (uses thinkingBudget)
 */
function isGemini3Model(modelId: string): boolean {
  // Handle both direct model IDs and gateway format (google/gemini-3-...)
  return modelId.includes('gemini-3-')
}

/**
 * Build Google thinking config based on model version
 * - Gemini 3 uses thinkingLevel ('minimal' | 'low' | 'medium' | 'high')
 * - Gemini 2.5 uses thinkingBudget (number)
 */
function buildGoogleThinkingConfig(
  modelId: string,
  thinking: ThinkingConfig
): Record<string, unknown> {
  const defaultBudget = 10000

  if (isGemini3Model(modelId)) {
    // Gemini 3 models use thinkingLevel
    return {
      thinkingConfig: {
        thinkingLevel: thinking.thinkingLevel || 'medium',
        includeThoughts: true,
      },
    }
  } else {
    // Gemini 2.5 models use thinkingBudget
    return {
      thinkingConfig: {
        thinkingBudget: thinking.budgetTokens || defaultBudget,
        includeThoughts: true,
      },
    }
  }
}

/**
 * Build provider options for thinking/reasoning based on provider type
 */
function buildProviderOptions(
  provider: AIProvider,
  modelId: string,
  thinking?: ThinkingConfig
): Record<string, unknown> | undefined {
  if (!thinking?.enabled) return undefined

  const defaultBudget = 10000

  switch (provider) {
    case 'openai':
      return {
        openai: {
          reasoningEffort: thinking.reasoningEffort || 'medium',
          reasoningSummary: 'auto',
        },
      }
    case 'anthropic':
      return {
        anthropic: {
          thinking: {
            type: 'enabled',
            budgetTokens: thinking.budgetTokens || defaultBudget,
          },
        },
      }
    case 'google':
      return {
        google: buildGoogleThinkingConfig(modelId, thinking),
      }
    case 'vercel':
      // For Vercel AI Gateway, determine underlying provider from model ID
      // Model IDs are in format "provider/model" e.g. "openai/gpt-5-mini"
      // The gateway will pass through provider options to the underlying model
      // Note: xAI grok-4 family models have built-in reasoning and do NOT support
      // the reasoningEffort parameter - omit xAI options entirely
      return {
        openai: {
          reasoningEffort: thinking.reasoningEffort || 'medium',
          reasoningSummary: 'auto',
        },
        anthropic: {
          thinking: {
            type: 'enabled',
            budgetTokens: thinking.budgetTokens || defaultBudget,
          },
        },
        google: buildGoogleThinkingConfig(modelId, thinking),
        minimax: {
          // MiniMax models use thinking config similar to others
          thinking: {
            type: 'enabled',
            budgetTokens: thinking.budgetTokens || defaultBudget,
          },
        },
      }
    default:
      return undefined
  }
}

/**
 * Maximum number of tool execution steps
 * Prevents infinite loops in agentic behavior
 */
const MAX_STEPS = 10

/**
 * Create an AI agent for email management
 *
 * Uses ToolLoopAgent for multi-step tool calling with automatic
 * reasoning-and-acting loop.
 */
export function createEmailAgent(options: {
  provider: AIProvider
  model: string
  apiKey: string
  accountId: string
  accountStats?: AccountStats
  thinking?: ThinkingConfig
}) {
  const { provider, model: modelId, apiKey, accountId, accountStats, thinking } = options

  logger.debug(
    `[AI Agent] Creating agent for provider=${provider}, model=${modelId}, accountId=${accountId}, thinking=${thinking?.enabled}`
  )

  // Create the model instance
  logger.debug(`[AI Agent] Creating model instance...`)
  let model = createModelInstance(provider, modelId, apiKey)

  // Wrap with DevTools middleware in development mode for debugging
  if (isDevelopment()) {
    model = wrapLanguageModel({
      model: model as any,
      middleware: devToolsMiddleware(),
    }) as any
    logger.debug(`[AI Agent] Model wrapped with DevTools middleware`)
  }
  logger.debug(`[AI Agent] Model instance created`)

  // Create tools bound to this account
  logger.debug(`[AI Agent] Creating tools for account ${accountId}...`)
  const tools = createTools(accountId)
  logger.debug(`[AI Agent] Tools created: ${Object.keys(tools).join(', ')}`)

  // Build system prompt with account context
  logger.debug(`[AI Agent] Building system prompt...`)
  const instructions = buildSystemPrompt(accountStats)
  logger.debug(`[AI Agent] System prompt built (${instructions.length} chars)`)

  // Build provider options for thinking if enabled
  const providerOptions = buildProviderOptions(provider, modelId, thinking)
  if (providerOptions) {
    logger.debug(`[AI Agent] Provider options for thinking:`, providerOptions)
  }

  // Create the agent with multi-step capabilities
  logger.debug(`[AI Agent] Creating ToolLoopAgent with maxSteps=${MAX_STEPS}...`)
  const agent = new ToolLoopAgent({
    model: model as any, // Type assertion for SDK version compatibility
    instructions,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: providerOptions as any,
  })
  logger.debug(`[AI Agent] Agent created successfully`)

  return agent
}

/**
 * Stream a response from the AI agent
 *
 * Uses the agent's stream method for streaming responses with tool execution.
 */
export function streamAgentResponse(options: {
  provider: AIProvider
  model: string
  apiKey: string
  accountId: string
  messages: ModelMessage[]
  accountStats?: AccountStats
}) {
  const agent = createEmailAgent(options)
  return agent.stream({ messages: options.messages })
}

/**
 * Generate a non-streaming response from the AI agent
 * Useful for simple queries that don't need streaming
 */
export async function generateAgentResponse(options: {
  provider: AIProvider
  model: string
  apiKey: string
  accountId: string
  messages: ModelMessage[]
  accountStats?: AccountStats
}): Promise<{
  text: string
  toolCalls: Array<{ toolName: string; args: unknown; result: unknown }>
  steps: unknown[]
}> {
  const agent = createEmailAgent(options)

  const result = await agent.generate({ messages: options.messages })

  // Extract tool calls from all steps
  const allToolCalls: Array<{ toolName: string; args: unknown; result: unknown }> = []

  for (const step of result.steps) {
    for (const toolCall of step.toolCalls) {
      allToolCalls.push({
        toolName: toolCall.toolName,
        args: toolCall.input,
        result: undefined, // Tool results are in separate step
      })
    }
  }

  return {
    text: result.text,
    toolCalls: allToolCalls,
    steps: result.steps,
  }
}

/**
 * Check if the agent response requires user approval
 * Returns the tool calls that need approval
 */
export function extractPendingApprovals(
  toolCalls: Array<{ toolName: string; args: unknown }>
): Array<{ toolName: string; args: unknown }> {
  return toolCalls.filter((call) => requiresApproval(call.toolName))
}

/**
 * Get a simple text response for quick queries
 * No tool execution, just a direct response
 */
export async function getQuickResponse(options: {
  provider: AIProvider
  model: string
  apiKey: string
  prompt: string
}): Promise<string> {
  const { provider, model: modelId, apiKey, prompt } = options

  const model = createModelInstance(provider, modelId, apiKey)

  // Simple agent without tools for quick responses
  const agent = new ToolLoopAgent({
    model: model as any, // Type assertion for SDK version compatibility
    stopWhen: stepCountIs(1), // Single step, no tools
  })

  const result = await agent.generate({
    prompt,
  })

  return result.text
}

/**
 * Create agent options from config
 */
export function createAgentOptions(options: {
  provider: AIProvider
  model: string
  apiKey: string
  accountId: string
  accountStats?: AccountStats
}): {
  provider: AIProvider
  model: string
  apiKey: string
  accountId: string
  accountStats?: AccountStats
} {
  return {
    provider: options.provider,
    model: options.model,
    apiKey: options.apiKey,
    accountId: options.accountId,
    accountStats: options.accountStats,
  }
}
