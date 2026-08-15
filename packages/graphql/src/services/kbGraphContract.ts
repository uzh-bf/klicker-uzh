import { z } from 'zod'

export const KB_GRAPH_CONTRACT_VERSION = 'klicker-kb-graph/v1' as const

const safeIdentifier = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)

const safeModelIdentifier = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/)

const uuidString = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase())

const sha256String = z
  .string()
  .regex(/^[a-f0-9]{64}$/i)
  .transform((value) => value.toLowerCase())

const artifactName = z
  .string()
  .trim()
  .transform((value) => value.replace(/^\/+|\/+$/g, ''))
  .refine((value) => value.length > 0)

const graphMlArtifactSchema = z
  .object({
    container_name: artifactName,
    blob_name: artifactName,
  })
  .strict()

const meteredCostComponentSchema = z
  .object({
    provider: safeIdentifier,
    model: safeModelIdentifier,
    amount_minor_units: z.number().int().min(0),
    pricing_version: safeIdentifier,
    embedding_tokens: z.number().int().min(0).default(0),
    input_tokens: z.number().int().min(0).default(0),
    output_tokens: z.number().int().min(0).default(0),
    request_count: z.number().int().min(0).default(0),
  })
  .strict()

const meteredCostSchema = z
  .object({
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/i)
      .transform((value) => value.toUpperCase()),
    amount_minor_units: z.number().int().min(0),
    components: z.array(meteredCostComponentSchema).min(1),
    metering_source: z.enum(['provider_reported', 'configured_pricing']),
  })
  .strict()
  .superRefine((value, context) => {
    const componentTotal = value.components.reduce(
      (total, component) => total + component.amount_minor_units,
      0
    )
    if (componentTotal !== value.amount_minor_units) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'amount_minor_units must equal the component total',
        path: ['amount_minor_units'],
      })
    }
  })

export const kbGraphTerminalResultSchema = z
  .object({
    contract_version: z.literal(KB_GRAPH_CONTRACT_VERSION),
    result_id: z.string().trim().min(1),
    build_id: uuidString,
    kb_id: uuidString,
    owner_id: uuidString,
    run_id: safeIdentifier,
    source_content_digest: sha256String,
    graph_name: safeIdentifier,
    status: z.enum([
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'TIMED_OUT',
      'NEEDS_HUMAN_REVIEW',
    ]),
    edge_count: z.number().int().min(0).default(0),
    error_code: safeIdentifier.nullable().default(null),
    failed_document_count: z.number().int().min(0).default(0),
    graphml_artifact: graphMlArtifactSchema.nullable().default(null),
    metered_cost: meteredCostSchema.nullable().default(null),
    node_count: z.number().int().min(0).default(0),
    processed_document_count: z.number().int().min(0).default(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.result_id !== `${value.build_id}:${value.run_id}`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'result_id must be derived from build_id and run_id',
        path: ['result_id'],
      })
    }
    if (value.graph_name !== `klickeruzh:kb:${value.kb_id}:${value.build_id}`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'graph_name must match the pinned KB/build identity',
        path: ['graph_name'],
      })
    }
    if (value.status === 'SUCCEEDED') {
      if (value.graphml_artifact === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SUCCEEDED results require a GraphML artifact',
          path: ['graphml_artifact'],
        })
      }
      if (value.metered_cost === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SUCCEEDED results require metered_cost',
          path: ['metered_cost'],
        })
      }
      if (value.error_code !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SUCCEEDED results cannot carry an error_code',
          path: ['error_code'],
        })
      }
    } else if (value.error_code === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'non-success terminal results require error_code',
        path: ['error_code'],
      })
    }
  })

export type KbGraphTerminalResult = z.infer<typeof kbGraphTerminalResultSchema>

export interface KbGraphTerminalResultExpectation {
  buildId: string
  kbId: string
  ownerId: string
  resultId: string
  runId?: string
  estimatedMinorUnits: number
}

export type KbGraphTerminalResultValidation =
  | { ok: true; result: KbGraphTerminalResult }
  | { ok: false; errors: string[] }

export function validateKbGraphTerminalResult(
  value: unknown,
  expectation: KbGraphTerminalResultExpectation
): KbGraphTerminalResultValidation {
  const parsed = kbGraphTerminalResultSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`
      ),
    }
  }

  const result = parsed.data
  const errors: string[] = []

  if (result.build_id !== expectation.buildId) {
    errors.push(
      `build_id mismatch: expected ${expectation.buildId}, got ${result.build_id}`
    )
  }
  if (result.kb_id !== expectation.kbId) {
    errors.push(
      `kb_id mismatch: expected ${expectation.kbId}, got ${result.kb_id}`
    )
  }
  if (result.owner_id !== expectation.ownerId) {
    errors.push(
      `owner_id mismatch: expected ${expectation.ownerId}, got ${result.owner_id}`
    )
  }
  if (result.result_id !== expectation.resultId) {
    errors.push(
      `result_id mismatch: expected ${expectation.resultId}, got ${result.result_id}`
    )
  }
  if (expectation.runId !== undefined && result.run_id !== expectation.runId) {
    errors.push(
      `run_id mismatch: expected ${expectation.runId}, got ${result.run_id}`
    )
  }

  const expectedGraphName = `klickeruzh:kb:${expectation.kbId}:${expectation.buildId}`
  if (result.graph_name !== expectedGraphName) {
    errors.push(
      `graph_name mismatch: expected ${expectedGraphName}, got ${result.graph_name}`
    )
  }

  if (
    !Number.isInteger(expectation.estimatedMinorUnits) ||
    expectation.estimatedMinorUnits < 0
  ) {
    errors.push(
      `estimatedMinorUnits must be a non-negative integer, got ${expectation.estimatedMinorUnits}`
    )
  } else if (
    result.metered_cost !== null &&
    result.metered_cost.amount_minor_units > expectation.estimatedMinorUnits
  ) {
    errors.push(
      `metered cost ${result.metered_cost.amount_minor_units} exceeds estimated reservation ${expectation.estimatedMinorUnits}`
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, result }
}
