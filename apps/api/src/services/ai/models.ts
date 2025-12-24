/**
 * AI Models Configuration
 *
 * Defines available AI providers, their models, and creates model instances.
 * Uses @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGateway } from '@ai-sdk/gateway'
import type { AIProvider } from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * AI Model definition
 */
export interface AIModel {
  id: string
  name: string
  recommended?: boolean
}

/**
 * AI Provider configuration
 */
export interface AIProviderConfig {
  id: AIProvider
  name: string
  models: AIModel[]
}

// ============================================================================
// Provider & Model Configuration
// ============================================================================

/**
 * Available AI providers and their models
 * Updated December 2025
 *
 * Sources:
 * - OpenAI: https://platform.openai.com/docs/models
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models/overview
 * - Google: https://ai.google.dev/gemini-api/docs/models
 */
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', recommended: true },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', recommended: true },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash', recommended: true },
      { id: 'gemini-3-pro', name: 'Gemini 3 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel AI Gateway',
    models: [
      // OpenAI models via Gateway
      { id: 'openai/gpt-5.2', name: 'GPT-5.2' },
      { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', recommended: true },
      { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
      // Anthropic models via Gateway
      { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5' },
      { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5' },
      // Google models via Gateway (Gemini 3 models require thought signatures which aren't supported via gateway)
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      // xAI Grok models via Gateway
      { id: 'xai/grok-4', name: 'Grok 4' },
      { id: 'xai/grok-4.1-fast-non-reasoning', name: 'Grok 4.1 Fast' },
      { id: 'xai/grok-4-fast-reasoning', name: 'Grok 4 Reasoning' },
      // zai GLM models via Gateway
      { id: 'zai/glm-4.6', name: 'GLM 4.6' },
      { id: 'zai/glm-4.7', name: 'GLM 4.7' },
      // Minimax models via Gateway
      { id: 'minimax/minimax-m2', name: 'Minimax M2' },
      { id: 'minimax/minimax-m2.1', name: 'Minimax M2.1' },
    ],
  },
]

// ============================================================================
// Provider Helper Functions
// ============================================================================

/**
 * Get provider configuration by ID
 */
export function getProviderConfig(providerId: AIProvider): AIProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId)
}

/**
 * Get provider name by ID
 */
export function getProviderName(providerId: AIProvider): string {
  return getProviderConfig(providerId)?.name ?? providerId
}

/**
 * Check if a model ID is valid for a given provider
 */
export function isValidModel(providerId: AIProvider, modelId: string): boolean {
  const provider = getProviderConfig(providerId)
  if (!provider) return false
  return provider.models.some((m) => m.id === modelId)
}

/**
 * Get the recommended model for a provider
 */
export function getRecommendedModel(providerId: AIProvider): AIModel | undefined {
  const provider = getProviderConfig(providerId)
  if (!provider) return undefined
  return provider.models.find((m) => m.recommended) ?? provider.models[0]
}

/**
 * Get model name by ID for a provider
 */
export function getModelName(providerId: AIProvider, modelId: string): string {
  const provider = getProviderConfig(providerId)
  if (!provider) return modelId
  const model = provider.models.find((m) => m.id === modelId)
  return model?.name ?? modelId
}

/**
 * Get all models for a provider
 */
export function getProviderModels(providerId: AIProvider): AIModel[] {
  return getProviderConfig(providerId)?.models ?? []
}

/**
 * Get the default model ID for a provider (the recommended one)
 */
export function getDefaultModelId(provider: AIProvider): string {
  const recommended = getRecommendedModel(provider)
  return recommended?.id ?? AI_PROVIDERS[0]?.models[0]?.id ?? 'gpt-5-mini'
}

// ============================================================================
// Model Instance Creation
// ============================================================================

/**
 * Create an AI model instance for the specified provider
 * Returns the model directly - let TypeScript infer the type
 */
export function createModelInstance(provider: AIProvider, modelId: string, apiKey: string) {
  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey })
      return openai(modelId)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey })
      return anthropic(modelId)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey })
      return google(modelId)
    }
    case 'vercel': {
      const gateway = createGateway({ apiKey })
      // modelId is in format "provider/model" e.g. "openai/gpt-5-mini"
      return gateway(modelId)
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}

/**
 * Validate that a model ID is valid for a provider
 * Uses the models list for validation
 */
export function isValidModelForProvider(provider: AIProvider, modelId: string): boolean {
  return isValidModel(provider, modelId)
}
