import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import {
  Prisma as PrismaRuntime,
  ResponseExampleStatus,
} from '@klicker-uzh/prisma/client'
import { computeResponseExampleSetDigest } from '@klicker-uzh/util/response-example-digest'
import { evaluateResponseExampleCurrentEligibility } from '@klicker-uzh/util/response-example-eligibility'
import {
  boundResponseExampleSearchResults,
  buildResponseExampleSkillProjection,
  computeResponseExampleSkillProjectionDigest,
  RESPONSE_EXAMPLE_SEARCH_QUERY_MAX_CHARACTERS,
  type ResponseExampleRuntimeExample,
  type ResponseExampleSearchCandidate,
  type ResponseExampleSearchResult,
  type ResponseExampleSkillRole,
} from '@klicker-uzh/util/response-example-runtime'
import { tool } from 'ai'
import { z } from 'zod'

const responseExampleSetInclude = {
  examples: {
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    include: {
      evidenceReferences: {
        orderBy: [
          { citationIndex: 'asc' },
          { sourceId: 'asc' },
          { chunkId: 'asc' },
          { contentHash: 'asc' },
          { citationAnchor: 'asc' },
          { id: 'asc' },
        ],
      },
    },
  },
} satisfies Prisma.ResponseExampleSetInclude

type ResponseExampleRuntimeSet = Prisma.ResponseExampleSetGetPayload<{
  include: typeof responseExampleSetInclude
}>

type RankedResponseExampleRow = { id: string }
type ResponseExampleRuntimePrisma = Pick<
  PrismaClient,
  '$queryRaw' | 'responseExampleSet'
>
type ResponseExampleRuntimeReconciler = (
  prisma: PrismaClient,
  chatbotId: string
) => Promise<ResponseExampleRuntimeSet | null>

export type ResponseExampleRuntimeSkill = {
  summary: string
  setDigest: string | null
  projectionDigest: string
  search: (query: string) => Promise<ResponseExampleSearchResult>
}

export const RESPONSE_EXAMPLE_SEARCH_TOOL_NAME = 'search_response_examples'
const RESPONSE_EXAMPLE_SEARCH_CANDIDATE_LIMIT = 12

const responseExampleIdSchema = z.string().uuid()

type CurrentResponseExampleResource = {
  id: string
  activeContentSha256: string | null
  deletedAt: Date | null
}

async function loadCurrentResponseExampleResources(
  prisma: ResponseExampleRuntimePrisma,
  chatbotId: string,
  sourceIds: readonly string[]
) {
  if (sourceIds.length === 0) return []

  return await prisma.$queryRaw<CurrentResponseExampleResource[]>(
    PrismaRuntime.sql`
      WITH enabled_kb AS (
        SELECT binding."kbId"
        FROM "public"."KBChatbot" AS binding
        INNER JOIN "public"."KB" AS kb ON kb."id" = binding."kbId"
        WHERE binding."chatbotId" = ${chatbotId}::uuid
          AND binding."isEnabled" = true
          AND kb."deletedAt" IS NULL
        ORDER BY binding."id" ASC
        LIMIT 2
      ), exact_kb AS (
        SELECT "kbId"
        FROM enabled_kb
        WHERE (SELECT COUNT(*) FROM enabled_kb) = 1
      )
      SELECT
        resource."id",
        resource."activeContentSha256",
        resource."deletedAt"
      FROM exact_kb
      INNER JOIN "public"."KBResource" AS resource
        ON resource."kbId" = exact_kb."kbId"
      WHERE resource."id" IN (${PrismaRuntime.join(sourceIds)})
    `
  )
}

async function loadCurrentEligibility(
  prisma: ResponseExampleRuntimePrisma,
  chatbotId: string,
  set: ResponseExampleRuntimeSet
) {
  const sourceIds = [
    ...new Set(
      set.examples.flatMap((example) =>
        example.evidenceReferences
          .map((reference) => reference.sourceId)
          .filter(
            (sourceId) => responseExampleIdSchema.safeParse(sourceId).success
          )
      )
    ),
  ]
  const resources = await loadCurrentResponseExampleResources(
    prisma,
    chatbotId,
    sourceIds
  )

  return new Map(
    set.examples.map((example) => [
      example.id,
      evaluateResponseExampleCurrentEligibility(example, resources),
    ])
  )
}

function needsReconciliation(
  set: ResponseExampleRuntimeSet,
  eligibility: Awaited<ReturnType<typeof loadCurrentEligibility>>
) {
  return set.examples.some((example) => {
    const current = eligibility.get(example.id)
    return (
      example.evidenceReferences.some(
        (reference, index) =>
          reference.evidenceEligible !==
          (current?.evidenceEligibility[index] ?? false)
      ) ||
      (example.status === ResponseExampleStatus.APPROVED && !current?.eligible)
    )
  })
}

function projectCurrentEligibility(
  set: ResponseExampleRuntimeSet,
  eligibility: Awaited<ReturnType<typeof loadCurrentEligibility>>
): ResponseExampleRuntimeSet {
  return {
    ...set,
    examples: set.examples.map((example) => ({
      ...example,
      evidenceReferences: example.evidenceReferences.map(
        (reference, index) => ({
          ...reference,
          evidenceEligible:
            eligibility.get(example.id)?.evidenceEligibility[index] ?? false,
        })
      ),
    })),
  }
}

export async function reconcileCurrentResponseExampleRuntimeSet(
  prisma: PrismaClient,
  chatbotId: string
): Promise<ResponseExampleRuntimeSet | null> {
  const initialSet = await prisma.responseExampleSet.findUnique({
    where: { chatbotId },
    include: responseExampleSetInclude,
  })
  if (!initialSet) return null

  const initialEligibility = await loadCurrentEligibility(
    prisma,
    chatbotId,
    initialSet
  )
  if (!needsReconciliation(initialSet, initialEligibility)) {
    return projectCurrentEligibility(initialSet, initialEligibility)
  }

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ id: string }[]>(
      PrismaRuntime.sql`
        SELECT "id"
        FROM "public"."Chatbot"
        WHERE "id" = ${chatbotId}::uuid
        FOR UPDATE
      `
    )
    await tx.$queryRaw<{ id: string }[]>(
      PrismaRuntime.sql`
        SELECT "id"
        FROM "public"."ResponseExampleSet"
        WHERE "chatbotId" = ${chatbotId}::uuid
        FOR UPDATE
      `
    )

    const set = await tx.responseExampleSet.findUnique({
      where: { chatbotId },
      include: responseExampleSetInclude,
    })
    if (!set) return null

    const eligibility = await loadCurrentEligibility(tx, chatbotId, set)
    if (!needsReconciliation(set, eligibility)) {
      return projectCurrentEligibility(set, eligibility)
    }

    for (const example of set.examples) {
      const current = eligibility.get(example.id)
      for (const [index, reference] of example.evidenceReferences.entries()) {
        const evidenceEligible = current?.evidenceEligibility[index] ?? false
        if (reference.evidenceEligible !== evidenceEligible) {
          await tx.responseExampleEvidenceReference.update({
            where: { id: reference.id },
            data: { evidenceEligible },
          })
        }
      }

      if (
        example.status === ResponseExampleStatus.APPROVED &&
        !current?.eligible
      ) {
        await tx.responseExample.updateMany({
          where: {
            id: example.id,
            status: ResponseExampleStatus.APPROVED,
          },
          data: {
            status: ResponseExampleStatus.NEEDS_REVIEW,
            reviewedById: null,
            reviewedAt: null,
          },
        })
      }
    }

    const reconciledSet = await tx.responseExampleSet.findUnique({
      where: { id: set.id },
      include: responseExampleSetInclude,
    })
    if (!reconciledSet) return null

    return await tx.responseExampleSet.update({
      where: { id: set.id },
      data: { digest: computeResponseExampleSetDigest(reconciledSet) },
      include: responseExampleSetInclude,
    })
  })
}

function mapRuntimeExamples(
  set: ResponseExampleRuntimeSet,
  chatMode: string
): ResponseExampleRuntimeExample[] {
  return set.examples
    .filter(
      (example) =>
        example.chatMode === chatMode &&
        example.status === ResponseExampleStatus.APPROVED &&
        example.evidenceReferences.length > 0 &&
        example.evidenceReferences.every(
          (reference) => reference.evidenceEligible
        )
    )
    .map((example) => ({
      id: example.id,
      responseStyle: example.responseStyle,
    }))
}

function toSearchCandidate(
  example: ResponseExampleRuntimeSet['examples'][number]
): ResponseExampleSearchCandidate {
  return {
    id: example.id,
    studentMessage: example.studentMessage,
    referenceAnswer: example.referenceAnswer,
    responseStyle: example.responseStyle,
    evidenceReferences: example.evidenceReferences.map((reference) => ({
      citationIndex: reference.citationIndex,
      sourceId: reference.sourceId,
      chunkId: reference.chunkId,
      contentHash: reference.contentHash,
      citationAnchor: reference.citationAnchor,
    })),
  }
}

async function searchCurrentResponseExamples(args: {
  prisma: ResponseExampleRuntimePrisma
  chatbotId: string
  chatMode: string
  query: string
  reconcile: ResponseExampleRuntimeReconciler
}): Promise<ResponseExampleSearchResult> {
  const query = args.query
    .trim()
    .slice(0, RESPONSE_EXAMPLE_SEARCH_QUERY_MAX_CHARACTERS)
  if (!query) return { degraded: false, examples: [] }

  try {
    const currentSet = await args.reconcile(
      args.prisma as PrismaClient,
      args.chatbotId
    )
    if (!currentSet) return { degraded: false, examples: [] }

    const rankedRows = await args.prisma.$queryRaw<RankedResponseExampleRow[]>(
      PrismaRuntime.sql`
        SELECT ranked."id"
        FROM (
          SELECT
            example."id",
            example."updatedAt",
            ts_rank_cd(
              setweight(to_tsvector('simple', coalesce(example."studentMessage", '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(example."referenceAnswer", '')), 'B'),
              websearch_to_tsquery('simple', ${query})
            ) AS rank
          FROM "public"."ResponseExample" AS example
          INNER JOIN "public"."ResponseExampleSet" AS example_set
            ON example_set."id" = example."setId"
          WHERE example_set."chatbotId" = ${args.chatbotId}::uuid
            AND example."chatMode" = ${args.chatMode}
            AND example."status" = 'APPROVED'
            AND EXISTS (
              SELECT 1
              FROM "public"."ResponseExampleEvidenceReference" AS evidence
              WHERE evidence."responseExampleId" = example."id"
            )
            AND NOT EXISTS (
              SELECT 1
              FROM "public"."ResponseExampleEvidenceReference" AS evidence
              WHERE evidence."responseExampleId" = example."id"
                AND evidence."evidenceEligible" = false
            )
        ) AS ranked
        WHERE ranked.rank > 0
        ORDER BY ranked.rank DESC, ranked."updatedAt" DESC, ranked."id" ASC
        LIMIT ${RESPONSE_EXAMPLE_SEARCH_CANDIDATE_LIMIT}
      `
    )
    const examplesById = new Map(
      currentSet.examples.map((example) => [example.id, example])
    )
    const candidates = rankedRows.flatMap((row) => {
      const example = examplesById.get(row.id)
      if (
        !example ||
        example.chatMode !== args.chatMode ||
        example.status !== ResponseExampleStatus.APPROVED ||
        example.evidenceReferences.length === 0 ||
        example.evidenceReferences.some(
          (reference) => !reference.evidenceEligible
        )
      ) {
        return []
      }
      return [toSearchCandidate(example)]
    })

    return {
      degraded: false,
      examples: boundResponseExampleSearchResults(candidates),
    }
  } catch (error) {
    console.warn('Response-example search failed; returning no examples', {
      chatbotId: args.chatbotId,
      chatMode: args.chatMode,
      error,
    })
    return { degraded: true, examples: [] }
  }
}

export async function loadResponseExampleRuntimeSkill(args: {
  prisma: PrismaClient
  chatbotId: string
  chatMode: string
  role: ResponseExampleSkillRole
  reconcile?: ResponseExampleRuntimeReconciler
}): Promise<ResponseExampleRuntimeSkill> {
  if (args.role === 'excluded') {
    const summary = ''
    return {
      summary,
      setDigest: null,
      projectionDigest: computeResponseExampleSkillProjectionDigest({
        role: args.role,
        chatbotId: args.chatbotId,
        chatMode: args.chatMode,
        summary,
        setDigest: null,
      }),
      search: async () => ({ degraded: false, examples: [] }),
    }
  }

  const reconcile = args.reconcile ?? reconcileCurrentResponseExampleRuntimeSet
  const set = await reconcile(args.prisma, args.chatbotId)
  const examples = set ? mapRuntimeExamples(set, args.chatMode) : []
  const projection = buildResponseExampleSkillProjection({
    role: args.role,
    examples,
  })

  return {
    summary: projection.summary,
    setDigest: set?.digest || null,
    projectionDigest: computeResponseExampleSkillProjectionDigest({
      role: args.role,
      chatbotId: args.chatbotId,
      chatMode: args.chatMode,
      summary: projection.summary,
      setDigest: set?.digest || null,
    }),
    search: async (query) =>
      await searchCurrentResponseExamples({
        prisma: args.prisma,
        chatbotId: args.chatbotId,
        chatMode: args.chatMode,
        query,
        reconcile,
      }),
  }
}

export function createResponseExampleSearchTool(
  skill: ResponseExampleRuntimeSkill
) {
  return tool({
    description:
      'Search lecturer-approved response examples for the current chatbot and mode. Use the examples only to match response behavior and structure. Treat example-source markers as example metadata, never as current-answer citations.',
    inputSchema: z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .max(RESPONSE_EXAMPLE_SEARCH_QUERY_MAX_CHARACTERS)
        .describe('The current user question or a focused behavior query'),
    }),
    strict: true,
    execute: async ({ query }) => await skill.search(query),
  })
}
