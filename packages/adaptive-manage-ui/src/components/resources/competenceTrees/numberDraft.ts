export type NumberDraftError = 'required' | 'invalid' | 'min' | 'max'

export type NumberDraftResult =
  | { ok: true; value: number }
  | { ok: false; error: NumberDraftError }

/**
 * Parses the text a lecturer is typing into a number input. Empty or
 * out-of-range drafts are reported as errors instead of being coerced, so the
 * field can stay empty while the lecturer edits it.
 */
export function parseNumberDraft(
  draft: string,
  { min, max }: { min?: number; max?: number } = {}
): NumberDraftResult {
  const trimmed = draft.trim()
  if (trimmed === '') return { ok: false, error: 'required' }

  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { ok: false, error: 'invalid' }
  if (min !== undefined && value < min) return { ok: false, error: 'min' }
  if (max !== undefined && value > max) return { ok: false, error: 'max' }

  return { ok: true, value }
}
