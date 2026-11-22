/** Host-owned tool used to render interactive explanations in Chat. */
export const SHOW_EXPLANATION_TOOL_NAME = 'show_explanation'

/** Attempts per turn, counting the first call and two repairs. */
export const MAX_EXPLANATION_ATTEMPTS = 3

export type ExplanationToolResult =
  | { kind: 'explanation'; content: Record<string, unknown> }
  | { kind: 'explanation-invalid'; errors: string[] }
  | { kind: 'explanation-unavailable' }

/** Leave room for a course search, repairs, and the closing text. */
export const EXPLANATION_TURN_MAX_STEPS = 7
export const EXPLANATION_TURN_MIN_OUTPUT_TOKENS = 16_384

type StepPart = { type: string; toolName?: string; output?: unknown }

/**
 * Failed attempts so far in this turn: results the service rejected or could
 * not check, and calls whose input did not parse. After the cap the tool is withdrawn, so a model
 * that cannot reach valid content falls back to text.
 */
export function failedExplanationAttempts(
  steps: ReadonlyArray<{ content: ReadonlyArray<StepPart> }>
): number {
  let failed = 0
  for (const step of steps)
    for (const part of step.content) {
      if (part.toolName !== SHOW_EXPLANATION_TOOL_NAME) continue
      if (part.type === 'tool-error') failed++
      else if (
        part.type === 'tool-result' &&
        ['explanation-invalid', 'explanation-unavailable'].includes(
          (part.output as { kind?: string } | undefined)?.kind ?? ''
        )
      )
        failed++
    }
  return failed
}

export function explanationAttemptsLeft(
  steps: ReadonlyArray<{ content: ReadonlyArray<StepPart> }>
): boolean {
  return failedExplanationAttempts(steps) < MAX_EXPLANATION_ATTEMPTS
}
