const SAFE_SCALAR_FIELDS = new Set([
  'requestId',
  'correlationId',
  'providerRoute',
  'customProvider',
  'selectedMode',
  'messageCount',
  'reasoningEffort',
  'maxOutputTokens',
  'systemPromptLength',
  'userPromptLengthTotal',
  'toolCount',
  'imageAttachmentCount',
  'elapsedMsFromRequestStart',
  'hasOwningThread',
  'status',
  'sawFinish',
  'sawAbort',
  'hadError',
  'elapsedMsFromStreamStart',
  'stepsCount',
  'hadPriorError',
  'hadAbort',
  'skippedAfterAbort',
  'reasoningTokensIncludedInOutput',
  'creditsUsed',
  'reasoningTokens',
  'partialTextLength',
  'partialReasoningLength',
  'finishReason',
  'warningsCount',
  'toolCallsCount',
  'classification',
  'retryable',
  'suggestedAction',
  'stage',
])

const SAFE_ARRAY_FIELDS = new Map<string, 'number' | 'string'>([
  ['allowedReasoningEfforts', 'string'],
  ['imageAttachmentSizes', 'number'],
])

const SAFE_USAGE_FIELDS = new Set([
  'inputTokens',
  'outputTokens',
  'totalTokens',
])
const SAFE_TOOL_DIAGNOSTIC_FIELDS = new Set(['inputBytes', 'outputBytes'])

function isSafeScalar(
  value: unknown
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

function sanitizeObject(
  value: unknown,
  allowedFields: Set<string>
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const output: Record<string, unknown> = {}
  for (const [key, fieldValue] of Object.entries(value)) {
    if (allowedFields.has(key) && isSafeScalar(fieldValue)) {
      output[key] = fieldValue
    }
  }
  return output
}

/**
 * Keep Chat diagnostics allowlisted even when a new call site passes an
 * accidentally broad context object. Content-derived values are intentionally
 * absent from this contract.
 */
export function sanitizeChatLogContext(
  context: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(context)) {
    if (SAFE_SCALAR_FIELDS.has(key) && isSafeScalar(value)) {
      output[key] = value
      continue
    }

    const arrayType = SAFE_ARRAY_FIELDS.get(key)
    if (arrayType && Array.isArray(value)) {
      const values = value.filter((item) =>
        arrayType === 'number'
          ? typeof item === 'number' && Number.isFinite(item)
          : typeof item === 'string'
      )
      output[key] = values
      continue
    }

    if (key === 'usage') {
      output[key] =
        value === null ? null : sanitizeObject(value, SAFE_USAGE_FIELDS)
      continue
    }

    if (key === 'toolDiagnostics' && Array.isArray(value)) {
      output[key] = value
        .map((diagnostic) =>
          sanitizeObject(diagnostic, SAFE_TOOL_DIAGNOSTIC_FIELDS)
        )
        .filter(
          (diagnostic): diagnostic is Record<string, unknown> =>
            diagnostic !== null
        )
    }
  }

  return output
}
