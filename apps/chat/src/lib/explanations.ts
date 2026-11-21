/** Shared by the chat route and the message UI; no server imports. */
export const SHOW_EXPLANATION_TOOL_NAME = 'show_explanation'

/** Attempts per turn, counting the first call and two repairs. */
export const MAX_EXPLANATION_ATTEMPTS = 3

export type ExplanationToolResult =
  | { kind: 'explanation'; content: Record<string, unknown> }
  | { kind: 'explanation-invalid'; errors: string[] }
  | { kind: 'explanation-unavailable' }
