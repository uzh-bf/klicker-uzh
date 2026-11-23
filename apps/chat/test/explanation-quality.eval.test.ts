import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { getChatModelRegistry } from '@/src/lib/server/chatModelRegistry'
import {
  type ExplanationBrief,
  type ExplanationDraftReport,
  explanationWriterReasoningEffort,
  resolveExplanationWriterConfig,
  writeExplanation,
} from '@/src/services/explainerService'

/*
 * Offline quality run of the explanation writer on synthetic briefs. It calls
 * the configured writer model and the explainer service, so it costs model
 * tokens and runs only on request:
 *
 *   CHAT_EXPLANATION_EVAL=1 EXPLAINER_SERVICE_URL=... EXPLAINER_SERVICE_TOKEN=... \
 *   OPENAI_BASE_URL=... OPENAI_API_KEY=... pnpm vitest run test/explanation-quality.eval.test.ts
 *
 * Optional: CHAT_EXPLANATION_EVAL_IDS (comma-separated brief IDs),
 * CHAT_EXPLANATION_EVAL_JUDGE_MODEL_ID (a registry model that scores each
 * explanation against a rubric), CHAT_EXPLANATION_EVAL_OUT (report directory,
 * default project/_local/explanation-eval, which is gitignored).
 */
const enabled = process.env.CHAT_EXPLANATION_EVAL === '1'
const CONCURRENCY = 3

type Case = { id: string; expect: string; brief: ExplanationBrief }

const Rubric = z.object({
  fidelity: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      'Facts, formulas and numbers agree with the brief and the subject.'
    ),
  fit: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe('The diagram type and its parts suit the concept.'),
  steps: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe('Each step says what changes, why, and what to notice.'),
  misconception: z
    .number()
    .int()
    .min(1)
    .max(5)
    .nullable()
    .describe('How directly it confronts the misconception; null without one.'),
  note: z.string().max(300),
})

function openAIModel(config: {
  deploymentId: string
  usesResponsesApi?: boolean
}) {
  const provider = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY || 'no-key',
  })
  return config.usesResponsesApi
    ? provider.responses(config.deploymentId)
    : provider.chat(config.deploymentId)
}

async function pool<T, R>(items: T[], n: number, run: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await run(items[i]!)
      }
    })
  )
  return out
}

describe.skipIf(!enabled)(
  'explanation writer quality (synthetic briefs)',
  () => {
    it('writes, validates and scores every brief', async () => {
      const registry = getChatModelRegistry()
      const config = resolveExplanationWriterConfig(registry, {
        ...registry[0]!,
        fallback: false,
      })
      const effort = explanationWriterReasoningEffort(config)
      const writer = {
        modelId: config.id,
        model: openAIModel(config),
        providerOptions: {
          openai: {
            ...(effort && { forceReasoning: true, reasoningEffort: effort }),
          },
        },
      }
      const judgeConfig = registry.find(
        (m) => m.id === process.env.CHAT_EXPLANATION_EVAL_JUDGE_MODEL_ID
      )
      const ids = process.env.CHAT_EXPLANATION_EVAL_IDS?.split(',')
      const cases = (
        JSON.parse(
          await readFile(
            resolve(__dirname, 'fixtures/explanation-briefs.json'),
            'utf8'
          )
        ) as Case[]
      ).filter((c) => !ids || ids.includes(c.id))

      const rows = await pool(cases, CONCURRENCY, async (c) => {
        const tokens = { inputTokens: 0, outputTokens: 0 }
        const startedAt = Date.now()
        const run = await writeExplanation({
          brief: c.brief,
          writer,
          onStepUsage: (u) => {
            tokens.inputTokens += u.inputTokens
            tokens.outputTokens += u.outputTokens
          },
        })
        const ms = Date.now() - startedAt
        const content =
          run.result.kind === 'explanation' ? run.result.content : null
        const diagram = (content?.diagram as { type?: string } | undefined)
          ?.type
        let score: z.infer<typeof Rubric> | null = null
        if (content && judgeConfig)
          score = (
            await generateObject({
              model: openAIModel(judgeConfig),
              schema: Rubric,
              telemetry: { isEnabled: false },
              prompt: `Score this interactive explanation, written for a university student from a tutor's brief, on the rubric. Be strict; 3 is adequate.\n\nBrief:\n${JSON.stringify(c.brief)}\n\nExplanation (explainer/1 JSON):\n${JSON.stringify(content)}`,
            })
          ).object
        return {
          id: c.id,
          locale: c.brief.locale,
          expect: c.expect,
          diagram: diagram ?? null,
          outcome: run.result.kind,
          drafts: run.drafts,
          heldBackShown: run.heldBackShown,
          reports: run.reports as ExplanationDraftReport[],
          ms,
          ...tokens,
          cost:
            (tokens.inputTokens * config.cost.input +
              tokens.outputTokens * config.cost.output) /
            1_000_000,
          score,
        }
      })

      const shown = rows.filter((r) => r.outcome === 'explanation')
      const mean = (xs: number[]) =>
        xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN
      const ms = rows.map((r) => r.ms).sort((a, b) => a - b)
      const scored = rows.flatMap((r) => (r.score ? [r.score] : []))
      const summary = {
        writer: config.id,
        reasoning: effort ?? null,
        judge: judgeConfig?.id ?? null,
        briefs: rows.length,
        shown: shown.length,
        firstDraftClean: rows.filter(
          (r) => r.reports[0]?.outcome === 'explanation'
        ).length,
        expectedDiagram: shown.filter((r) => r.diagram === r.expect).length,
        meanDrafts: mean(rows.map((r) => r.drafts)),
        meanMs: Math.round(mean(ms)),
        p95Ms: ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))],
        totalCost: +rows.reduce((a, r) => a + r.cost, 0).toFixed(4),
        rubric: scored.length
          ? {
              fidelity: mean(scored.map((s) => s.fidelity)),
              fit: mean(scored.map((s) => s.fit)),
              steps: mean(scored.map((s) => s.steps)),
              misconception: mean(
                scored.flatMap((s) =>
                  s.misconception === null ? [] : [s.misconception]
                )
              ),
            }
          : null,
      }
      const dir = resolve(
        process.cwd(),
        process.env.CHAT_EXPLANATION_EVAL_OUT ??
          '../../project/_local/explanation-eval'
      )
      await mkdir(dir, { recursive: true })
      const file = resolve(
        dir,
        `${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      )
      await writeFile(file, JSON.stringify({ summary, rows }, null, 2))
      console.info('Explanation quality', summary, `report: ${file}`)
      expect(rows).toHaveLength(cases.length)
    }, 3_600_000)
  }
)
