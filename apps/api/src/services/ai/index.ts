/**
 * AI Service
 *
 * Main exports for the AI agent system.
 */

// Types
export type {
  AIProvider,
  AccountStats,
  CreateAgentOptions,
  AgentStreamChunk,
  StoredMessage,
} from './types'

export {
  storedToModelMessages,
  formatBytes,
  CATEGORY_NAMES,
  CATEGORY_IDS,
  AI_PROVIDER_IDS,
} from './types'

// Models
export {
  createModelInstance,
  getDefaultModelId,
  isValidModelForProvider,
  AI_PROVIDERS,
  getProviderConfig,
  getProviderName,
  isValidModel,
  getRecommendedModel,
  getModelName,
  getProviderModels,
  type AIModel,
  type AIProviderConfig,
} from './models'

// Prompt
export {
  buildSystemPrompt,
  getSuggestedPrompts,
  getCleanupQueries,
  CLEANUP_PATTERNS,
} from './prompt'

// Tools
export { createTools, getToolsRequiringApproval, requiresApproval } from './tools'

// Agent
export {
  createEmailAgent,
  streamAgentResponse,
  generateAgentResponse,
  extractPendingApprovals,
  getQuickResponse,
  createAgentOptions,
} from './agent'
