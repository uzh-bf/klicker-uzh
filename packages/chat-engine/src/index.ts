// @klicker-uzh/chat-engine
//
// The validated Mastra chat engine, promoted from the prototype into a real
// workspace package. Pure and DB-free: agent/provider construction, the Responses
// API body-shape shim, input guardrails, token cost, native observability, and
// the MCP toolset builder. The host service (apps/chat-api) owns all DB access,
// persistence, credits, and HTTP.
//
// DIY-memory modules (student profile, semantic recall, compression,
// sub-agents) and their backing storage land in Phase 5 once a production-Prisma
// design exists.

export {
  buildAgent,
  resolveInstructions,
  responsesProviderOptions,
} from './agent.js'
export type { AgentExtras } from './agent.js'
export { calcCost, costForModel, costForTokens, formatCost } from './cost.js'
export type { CostBase } from './cost.js'
export { DEFAULT_GUARDRAILS, buildInputProcessors } from './guardrails.js'
export type { GuardrailConfig } from './guardrails.js'
export { buildAuthHeaders, buildMcpToolset } from './mcp.js'
export type { McpServerConfig, McpToolset } from './mcp.js'
export { shutdownObservability, withObservability } from './observability.js'
export { responsesApiFetch } from './responsesApiFetch.js'
export type { ChatbotConfig } from './types.js'
