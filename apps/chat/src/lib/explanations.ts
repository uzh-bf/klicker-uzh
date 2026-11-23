/** Shared by the chat route and the message UI; no server imports. */
export const SHOW_EXPLANATION_TOOL_NAME = 'show_explanation'

/**
 * Calls per turn. The writer model repairs its own drafts, so after a failed
 * call the tutor answers in text instead of starting another round of drafts.
 */
export const MAX_EXPLANATION_ATTEMPTS = 1

export type ExplanationToolResult =
  | { kind: 'explanation'; content: Record<string, unknown> }
  | { kind: 'explanation-invalid'; errors: string[] }
  | { kind: 'explanation-unavailable' }
