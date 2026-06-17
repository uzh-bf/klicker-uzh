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
export {
  TUTOR_WORKING_MEMORY_TEMPLATE,
  buildTutorMastraMemoryRuntime,
} from './tutor/mastraMemory.js'
export type {
  TutorMastraMemoryOptions,
  TutorMastraMemoryRuntime,
} from './tutor/mastraMemory.js'
export {
  TUTOR_MEMORY_CATEGORIES,
  composeTutorMemoryInstructionsSuffix,
  evaluateTutorMemoryGate,
} from './tutor/memoryGate.js'
export type {
  TutorMemoryCategory,
  TutorMemoryGateConfig,
  TutorMemoryGateDecision,
} from './tutor/memoryGate.js'
export { selectTutorMovePolicy } from './tutor/policy.js'
export type {
  TutorAllowedMove,
  TutorMovePolicy,
  TutorPolicyState,
} from './tutor/policy.js'
export { composeTutorInstructionsSuffix } from './tutor/prompt.js'
export {
  composeTutorVerifierInstructionsSuffix,
  extractEvidenceIdsFromToolPayload,
  runTutorVerifierPreflight,
  verifyTutorOutputText,
} from './tutor/verifier.js'
export type {
  TutorOutputVerification,
  TutorVerifierFailure,
  TutorVerifierPreflight,
} from './tutor/verifier.js'
export {
  TUTOR_TURN_WORKFLOW_STEPS,
  TutorWorkflowOutputSchema,
  tutorTurnWorkflow,
} from './tutor/workflow.js'
export type { ChatbotConfig } from './types.js'
