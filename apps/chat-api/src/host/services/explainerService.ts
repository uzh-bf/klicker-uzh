import {
  engineExplanationDraftRequestSchema,
  type EngineExplanationDraftRequest,
  type EngineExplanationDraftResult,
} from '@klicker-uzh/chat-engine-contract'
import {
  generateText,
  isStepCount,
  jsonSchema,
  type LanguageModel,
  type Tool,
  tool,
} from 'ai'
import { z } from 'zod'
import {
  type ExplanationToolResult,
  MAX_EXPLANATION_ATTEMPTS,
} from '../lib/explanations.js'
import { renderPromptTemplate } from '../lib/server/promptTemplates.js'

/*
 * Client for the Catalyst explainer service. It validates explanations a model
 * writes and builds their pages; KlickerUZH keeps only the content in the
 * message and renders the page in a sandboxed frame.
 */

const REQUEST_TIMEOUT_MS = 10_000
/* The schema fetch blocks the start of every tutor turn, so it fails fast and
 * a failure is remembered briefly instead of retried on each turn. */
const SCHEMA_TIMEOUT_MS = 2_000
const SCHEMA_RETRY_AFTER_MS = 60_000
/* Errors beyond this many add little for a repair and cost tokens. */
const MAX_REPORTED_ERRORS = 25
/* Hints are advice; a long list would crowd out the errors that block the draft. */
const MAX_REPORTED_HINTS = 8

type ServiceConfig = { url: string; token: string }

function serviceConfig(): ServiceConfig | null {
  const url = process.env.EXPLAINER_SERVICE_URL?.trim()
  const token = process.env.EXPLAINER_SERVICE_TOKEN?.trim()
  if (!url || !token) return null
  return { url: url.replace(/\/+$/, ''), token }
}

/** The tool is a prototype: it needs the service and an explicit opt-in. */
export function isExplanationToolEnabled(chatMode: string): boolean {
  return (
    process.env.CHAT_EXPLANATION_TOOL === '1' &&
    serviceConfig() !== null &&
    (chatMode === 'tutor' || chatMode === 'explainer')
  )
}

/**
 * Offers the tool only when the deployment gate, the chatbot setting and the
 * owner's rollout all allow it. The flag lookup runs last, only when needed.
 */
export async function shouldOfferExplanationTool(params: {
  chatMode: string
  chatbotSettingEnabled: boolean
  isOwnerFlagEnabled: () => Promise<boolean>
}): Promise<boolean> {
  return (
    isExplanationToolEnabled(params.chatMode) &&
    params.chatbotSettingEnabled &&
    (await params.isOwnerFlagEnabled())
  )
}

async function call<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs?: number }
): Promise<{ status: number; data: T }> {
  const config = serviceConfig()
  if (!config) throw new Error('Explainer service is not configured')
  const response = await fetch(`${config.url}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${config.token}`,
      ...(init.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
  })
  return { status: response.status, data: (await response.json()) as T }
}

let schemaPromise: Promise<Record<string, unknown>> | null = null
let schemaFailedAt = 0

/** The content schema changes only with a service release, so one fetch per process is enough. */
export function getExplanationSchema(): Promise<Record<string, unknown>> {
  if (!schemaPromise && Date.now() - schemaFailedAt < SCHEMA_RETRY_AFTER_MS)
    return Promise.reject(new Error('schema request failed recently'))
  schemaPromise ??= call<Record<string, unknown>>('/explainer/v1/schema', {
    method: 'GET',
    timeoutMs: SCHEMA_TIMEOUT_MS,
  })
    .then(({ status, data }) => {
      if (status !== 200) throw new Error(`schema request failed: ${status}`)
      // The dialect marker is not part of a tool input schema.
      const schema = { ...data }
      delete schema.$schema
      return schema
    })
    .catch((error) => {
      schemaPromise = null
      schemaFailedAt = Date.now()
      throw error
    })
  return schemaPromise
}

/**
 * A valid draft held back once, so the writer can act on the service's
 * quality hints before the student sees it.
 */
type ExplanationReview = { kind: 'explanation-review'; hints: string[] }
type ExplanationDraftResult =
  | ExplanationToolResult
  | { kind: 'explanation-invalid'; errors: string[]; hints: string[] }
  | ExplanationReview

/**
 * With `withHints`, the service's quality hints come back with the errors, and
 * a draft without errors but with hints is held back for one revision.
 */
export async function validateExplanation(
  content: unknown,
  { withHints = false }: { withHints?: boolean } = {}
): Promise<ExplanationDraftResult> {
  const { status, data } = await call<{
    ok: boolean
    errors: string[]
    hints?: string[]
  }>('/explainer/v1/validate', { method: 'POST', body: { content } })
  if (status === 413)
    return {
      kind: 'explanation-invalid',
      errors: ['(root): content is too large; shorten it'],
    }
  if (status !== 200) return { kind: 'explanation-unavailable' }
  const hints = withHints ? (data.hints ?? []).slice(0, MAX_REPORTED_HINTS) : []
  if (!data.ok)
    return {
      kind: 'explanation-invalid',
      errors: data.errors.slice(0, MAX_REPORTED_ERRORS),
      ...(hints.length ? { hints } : {}),
    }
  if (hints.length) return { kind: 'explanation-review', hints }
  return { kind: 'explanation', content: content as Record<string, unknown> }
}

function draftFeedback(output: ExplanationDraftResult): string {
  if (output.kind === 'explanation') return 'Accepted.'
  if (output.kind === 'explanation-unavailable')
    return 'The validation service is unavailable. Stop.'
  if (output.kind === 'explanation-review')
    return `Review these hints on your draft and fix the ones that apply, then submit the complete object again. If none applies, submit it unchanged:\n${output.hints.join('\n')}`
  const hints = 'hints' in output ? output.hints.join('\n') : ''
  return `Fix every error and submit the complete object again:\n${output.errors.join('\n')}${hints ? `\nAlso review these hints and fix the ones that apply:\n${hints}` : ''}`
}

/** Builds the compact page for a chat frame; the chat has no dark mode, so the theme is light. */
export async function buildExplanationPage(
  content: unknown
): Promise<{ html: string } | { errors: string[] } | null> {
  const { status, data } = await call<{ html?: string; errors?: string[] }>(
    '/explainer/v1/page',
    { method: 'POST', body: { content, embed: true, theme: 'light' } }
  )
  if (status === 200 && typeof data.html === 'string')
    return { html: data.html }
  if (status === 422 && Array.isArray(data.errors))
    return { errors: data.errors }
  return null
}

/*
 * The tutor writes a short brief and a pinned writer model drafts the
 * explanation. Auto routing sizes a turn by the student's question, so the
 * turn's own model is often too weak for a long structured object.
 */
const DEFAULT_WRITER_MODEL_ID = 'gpt-6.2-sol'
const DEFAULT_WRITER_REASONING = 'high'
/* Drafts per call: the first and two repairs. */
const MAX_WRITER_DRAFTS = 3
/* An explanation is about 5-6k output tokens; reasoning tokens count as output. */
export const WRITER_MAX_OUTPUT_TOKENS = 20_000
const WRITER_TIMEOUT_MS = 180_000
/* The ingress closes a response that sends nothing for 60 seconds, so the
 * tool reports progress while the writer works. */
const WRITER_HEARTBEAT_MS = 15_000

export type ExplanationWriter =
  | {
      modelId: string
      model: LanguageModel
      providerOptions?: Parameters<typeof generateText>[0]['providerOptions']
    }
  | {
      modelId: string
      generateDraft: (
        input: Pick<
          EngineExplanationDraftRequest,
          'inputSchema' | 'systemPrompt' | 'prompt' | 'previous'
        >,
        signal: AbortSignal
      ) => Promise<EngineExplanationDraftResult>
    }

export type ExplanationWriterUsage = {
  inputTokens: number
  outputTokens: number
}

/**
 * The configured writer model, or the turn's model when the writer is not in
 * the registry or the turn runs on a fallback model (a guest, or a
 * participant without credits).
 */
export function resolveExplanationWriterConfig<
  T extends { id: string; fallback: boolean },
>(registry: readonly T[], turnModel: T): T {
  if (turnModel.fallback) return turnModel
  const id =
    process.env.CHAT_EXPLANATION_WRITER_MODEL_ID?.trim() ||
    DEFAULT_WRITER_MODEL_ID
  return registry.find((model) => model.id === id) ?? turnModel
}

/** The configured reasoning effort if the model offers it, else its highest. */
export function explanationWriterReasoningEffort(model: {
  supportedReasoningEfforts?: readonly string[]
}): string | undefined {
  const supported = model.supportedReasoningEfforts ?? []
  const wanted =
    process.env.CHAT_EXPLANATION_WRITER_REASONING?.trim() ||
    DEFAULT_WRITER_REASONING
  return supported.includes(wanted) ? wanted : supported.at(-1)
}

export const explanationBriefSchema = z.object({
  locale: z.enum(['de', 'en']).describe('The reply language.'),
  topic: z
    .string()
    .min(1)
    .max(200)
    .describe('The concept to explain, in a few words.'),
  brief: z
    .string()
    .min(1)
    .max(4000)
    .describe(
      'What the student should understand, and the key relationships the explanation walks through.'
    ),
  misconception: z
    .string()
    .max(600)
    .optional()
    .describe(
      'What the student got wrong or is likely to confuse, if anything.'
    ),
  notation: z
    .string()
    .max(1000)
    .optional()
    .describe(
      'Symbols, formulas and terms exactly as the course material writes them.'
    ),
  numbers: z
    .string()
    .max(1000)
    .optional()
    .describe(
      'The numbers to use, each marked as from the course material or illustrative.'
    ),
  sources: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        locator: z
          .string()
          .max(100)
          .optional()
          .describe('Page or section, e.g. "p. 12".'),
      })
    )
    .max(8)
    .optional()
    .describe('The course documents the explanation draws on.'),
})
export type ExplanationBrief = z.infer<typeof explanationBriefSchema>

function briefPrompt(brief: ExplanationBrief): string {
  const sources = brief.sources?.length
    ? brief.sources
        .map((s) => `- ${s.title}${s.locator ? ` (${s.locator})` : ''}`)
        .join('\n')
    : 'none'
  const parts = [
    `Locale: ${brief.locale}`,
    `Topic: ${brief.topic}`,
    `Brief:\n${brief.brief}`,
    brief.misconception && `Misconception to address:\n${brief.misconception}`,
    brief.notation && `Course notation:\n${brief.notation}`,
    brief.numbers && `Numbers:\n${brief.numbers}`,
    `Sources:\n${sources}`,
  ]
  return parts.filter(Boolean).join('\n\n')
}

/**
 * What one draft's validation found, without content: the outcome, counts, and
 * the top-level areas of the content the errors and hints point at.
 */
export type ExplanationDraftReport = {
  outcome: string
  errors: number
  hints: number
  areas: string[]
}

function draftReport(r: ExplanationDraftResult): ExplanationDraftReport {
  const errors = r.kind === 'explanation-invalid' ? r.errors : []
  const hints = 'hints' in r ? r.hints : []
  return {
    outcome: r.kind,
    errors: errors.length,
    hints: hints.length,
    areas: [
      ...new Set(
        [...errors, ...hints].map((m) => m.split(/[.[:\s]/, 1)[0] ?? '')
      ),
    ].filter(Boolean),
  }
}

/**
 * Has the writer draft and repair the explanation against the service: errors
 * go back on every draft, quality hints once. Stops at the first accepted
 * draft or after three. A valid draft held back for its hints is still shown
 * when the revision fails. `onStepUsage` receives each finished step's tokens
 * at once, so a stopped turn is charged for the drafts already written.
 */
export async function writeExplanation({
  brief,
  writer,
  abortSignal,
  onStepUsage,
}: {
  brief: ExplanationBrief
  writer: ExplanationWriter
  abortSignal?: AbortSignal
  onStepUsage?: (usage: ExplanationWriterUsage) => void
}): Promise<{
  result: ExplanationToolResult
  drafts: number
  reports: ExplanationDraftReport[]
  /** The shown explanation is a draft held back for hints, after its revision failed. */
  heldBackShown: boolean
}> {
  const schema = await getExplanationSchema()
  const reports: ExplanationDraftReport[] = []
  let drafts = 0
  let hintsSent = false
  let last: ExplanationDraftResult | null = null
  let heldBack: Record<string, unknown> | null = null
  const validate = async (
    content: Record<string, unknown>
  ): Promise<ExplanationDraftResult> => {
    drafts++
    // The last draft is shown if it is valid, so it gets no hints.
    const result = await validateExplanation(content, {
      withHints: !hintsSent && drafts < MAX_WRITER_DRAFTS,
    }).catch(() => ({ kind: 'explanation-unavailable' as const }))
    if ('hints' in result && result.hints.length) hintsSent = true
    if (result.kind === 'explanation-review') heldBack = content
    reports.push(draftReport(result))
    last = result
    return result
  }
  const submit = tool({
    description: 'Submit the complete explainer/1 content object.',
    // Not validated by the SDK: the service is the gate and reports errors
    // the writer can repair.
    inputSchema: jsonSchema<Record<string, unknown>>(schema),
    execute: validate,
    toModelOutput: ({ output }) => ({
      type: 'text' as const,
      value: draftFeedback(output),
    }),
  })
  const signals = [AbortSignal.timeout(WRITER_TIMEOUT_MS)]
  if (abortSignal) signals.push(abortSignal)
  try {
    if ('generateDraft' in writer) {
      const previous: EngineExplanationDraftRequest['previous'] = []
      const signal = AbortSignal.any(signals)
      const inputSchema =
        engineExplanationDraftRequestSchema.shape.inputSchema.parse(schema)
      while (drafts < MAX_WRITER_DRAFTS) {
        signal.throwIfAborted()
        const next = await writer.generateDraft(
          {
            inputSchema,
            prompt: briefPrompt(brief),
            systemPrompt: renderPromptTemplate('explanation-writer', {}),
            previous,
          },
          signal
        )
        onStepUsage?.(next.usage)
        if (!next.draft) break
        const outcome = await validate(next.draft)
        if (
          outcome.kind === 'explanation' ||
          outcome.kind === 'explanation-unavailable'
        )
          break
        previous.push({ draft: next.draft, feedback: draftFeedback(outcome) })
      }
    } else {
      await generateText({
        model: writer.model,
        system: renderPromptTemplate('explanation-writer', {}),
        prompt: briefPrompt(brief),
        tools: { submit_explanation: submit },
        toolChoice: 'required',
        stopWhen: [
          isStepCount(MAX_WRITER_DRAFTS),
          () =>
            (last as ExplanationDraftResult | null)?.kind === 'explanation' ||
            (last as ExplanationDraftResult | null)?.kind ===
              'explanation-unavailable',
        ],
        maxOutputTokens: WRITER_MAX_OUTPUT_TOKENS,
        providerOptions: writer.providerOptions,
        abortSignal: AbortSignal.any(signals),
        // Like the other auxiliary calls: the brief and drafts derive from the
        // student's question and stay out of traces.
        telemetry: { isEnabled: false },
        onStepEnd: (step) =>
          onStepUsage?.({
            inputTokens: step.usage.inputTokens ?? 0,
            outputTokens: step.usage.outputTokens ?? 0,
          }),
      })
    }
  } catch (error) {
    console.warn('Explanation writer failed', {
      modelId: writer.modelId,
      drafts,
      error:
        'generateDraft' in writer
          ? 'engine_draft_failed'
          : error instanceof Error
            ? error.message
            : String(error),
    })
    const kept = heldBack as Record<string, unknown> | null
    return {
      result: kept
        ? { kind: 'explanation', content: kept }
        : { kind: 'explanation-unavailable' },
      drafts,
      reports,
      heldBackShown: kept !== null,
    }
  }
  const final = last as ExplanationDraftResult | null
  const kept = heldBack as Record<string, unknown> | null
  const result: ExplanationToolResult =
    final?.kind === 'explanation'
      ? final
      : kept
        ? { kind: 'explanation', content: kept }
        : final?.kind === 'explanation-unavailable'
          ? final
          : {
              kind: 'explanation-invalid',
              errors:
                final?.kind === 'explanation-invalid'
                  ? final.errors
                  : ['the writer returned no valid explanation'],
            }
  return {
    result,
    drafts,
    reports,
    heldBackShown: final?.kind !== 'explanation' && kept !== null,
  }
}

type ExplanationPending = { kind: 'explanation-pending' }

function explanationToolOutput(
  output: ExplanationToolResult | ExplanationPending
): string {
  if (output.kind === 'explanation')
    return 'The explanation is shown to the student. Do not repeat its content. In at most two sentences, say what it shows and ask one question that has the student predict something or try a slider, aimed at their question.'
  return 'The explanation could not be built. Answer in text instead.'
}

/**
 * The tutor's tool. The writer is resolved when the turn's model options are
 * known, so it is read at call time; without one the call reports the service
 * as unavailable. `onUsage` receives the writer's tokens per finished step for
 * the turn's cost.
 */
export async function createShowExplanationTool({
  getWriter,
  onUsage,
  description,
}: {
  getWriter: () => ExplanationWriter | null
  description?: string
  onUsage: (usage: ExplanationWriterUsage) => void
}): Promise<
  Tool<ExplanationBrief, ExplanationToolResult | ExplanationPending>
> {
  // Offer the tool only when the service answers.
  await getExplanationSchema()
  let availableAttempts = MAX_EXPLANATION_ATTEMPTS
  return tool({
    description: description ?? renderPromptTemplate('explanation-tool', {}),
    inputSchema: explanationBriefSchema,
    execute: async function* (
      brief,
      { abortSignal }
    ): AsyncGenerator<ExplanationToolResult | ExplanationPending> {
      const writer = getWriter()
      if (!writer || availableAttempts === 0) {
        yield { kind: 'explanation-unavailable' }
        return
      }
      availableAttempts--
      const startedAt = Date.now()
      const tokens = { inputTokens: 0, outputTokens: 0 }
      const run = writeExplanation({
        brief,
        writer,
        abortSignal,
        onStepUsage: (usage) => {
          tokens.inputTokens += usage.inputTokens
          tokens.outputTokens += usage.outputTokens
          onUsage(usage)
        },
      }).then(({ result, drafts, reports, heldBackShown }) => {
        // Content-free quality metrics: counts and content areas, never text.
        const diagram =
          result.kind === 'explanation'
            ? (result.content.diagram as { type?: unknown } | undefined)?.type
            : undefined
        console.info('Explanation written', {
          modelId: writer.modelId,
          locale: brief.locale,
          diagram: typeof diagram === 'string' ? diagram : null,
          drafts,
          outcome: result.kind,
          heldBackShown,
          // One flat string per draft (outcome:errors/hints:areas), so log
          // collectors do not collapse the nested lists.
          reports: reports.map(
            (r) => `${r.outcome}:${r.errors}/${r.hints}:${r.areas.join('+')}`
          ),
          ...tokens,
          durationMs: Date.now() - startedAt,
        })
        return result
      })
      for (;;) {
        const result = await Promise.race([
          run,
          new Promise<null>((resolve) =>
            setTimeout(resolve, WRITER_HEARTBEAT_MS, null)
          ),
        ])
        if (result) {
          if (result.kind === 'explanation') availableAttempts++
          yield result
          return
        }
        // A preliminary result keeps the stream alive; the card keeps its
        // preparing state because the kind is not a final one.
        yield { kind: 'explanation-pending' }
      }
    },
    toModelOutput: ({ output }) => ({
      type: 'text' as const,
      value: explanationToolOutput(output),
    }),
  })
}

export {
  explanationAttemptsLeft,
  failedExplanationAttempts,
} from '@klicker-uzh/chat-engine-contract'

export async function createHostExplanationTool(
  options: Parameters<typeof createShowExplanationTool>[0]
): Promise<{
  definition: Tool<ExplanationBrief, ExplanationToolResult | ExplanationPending>
  instructions: string
}> {
  const definition = await createShowExplanationTool({
    ...options,
    description: 'Show a validated interactive explanation to the learner.',
  })
  return {
    definition,
    instructions: renderPromptTemplate('explanation-tool', {}),
  }
}
