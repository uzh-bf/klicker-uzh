import { jsonSchema, tool } from 'ai'
import {
  type ExplanationToolResult,
  MAX_EXPLANATION_ATTEMPTS,
  SHOW_EXPLANATION_TOOL_NAME,
} from '@/src/lib/explanations'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

/*
 * Client for the Catalyst explainer service. It validates explanations a model
 * writes and builds their pages; KlickerUZH keeps only the content in the
 * message and renders the page in a sandboxed frame.
 */

const REQUEST_TIMEOUT_MS = 10_000
/* Errors beyond this many add little for a repair and cost tokens. */
const MAX_REPORTED_ERRORS = 25

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

async function call<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown }
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return { status: response.status, data: (await response.json()) as T }
}

let schemaPromise: Promise<Record<string, unknown>> | null = null

/** The content schema changes only with a service release, so one fetch per process is enough. */
export function getExplanationSchema(): Promise<Record<string, unknown>> {
  schemaPromise ??= call<Record<string, unknown>>('/explainer/v1/schema', {
    method: 'GET',
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
      throw error
    })
  return schemaPromise
}

export async function validateExplanation(
  content: unknown
): Promise<ExplanationToolResult> {
  const { status, data } = await call<{ ok: boolean; errors: string[] }>(
    '/explainer/v1/validate',
    { method: 'POST', body: { content } }
  )
  if (status === 413)
    return {
      kind: 'explanation-invalid',
      errors: ['(root): content is too large; shorten it'],
    }
  if (status !== 200) return { kind: 'explanation-unavailable' }
  return data.ok
    ? { kind: 'explanation', content: content as Record<string, unknown> }
    : {
        kind: 'explanation-invalid',
        errors: data.errors.slice(0, MAX_REPORTED_ERRORS),
      }
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

export async function createShowExplanationTool() {
  const schema = await getExplanationSchema()
  return tool({
    description: renderPromptTemplate('explanation-tool', {}),
    // Not validated by the SDK: the service is the gate and reports errors
    // the model can repair.
    inputSchema: jsonSchema<Record<string, unknown>>(schema),
    execute: async (content): Promise<ExplanationToolResult> =>
      validateExplanation(content).catch(() => ({
        kind: 'explanation-unavailable' as const,
      })),
    toModelOutput: ({ output }) => ({
      type: 'text' as const,
      value:
        output.kind === 'explanation'
          ? 'The explanation is shown to the student. Do not repeat its content; add at most two sentences.'
          : output.kind === 'explanation-invalid'
            ? `The explanation was not shown. Fix every error and call ${SHOW_EXPLANATION_TOOL_NAME} again with the complete object:\n${output.errors.join('\n')}`
            : 'The explanation service is unavailable. Answer in text instead.',
    }),
  })
}

type StepPart = { type: string; toolName?: string; output?: unknown }

/**
 * Failed attempts so far in this turn: results the service rejected and calls
 * whose input did not parse. After the cap the tool is withdrawn, so a model
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
        (part.output as { kind?: string } | undefined)?.kind ===
          'explanation-invalid'
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
