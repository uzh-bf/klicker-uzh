import { createHash, randomInt } from 'node:crypto'
import {
  ADAPTIVE_DRY_RUN_MAX_DECISIONS,
  ADAPTIVE_DRY_RUN_MAX_STUDENTS,
  AdaptiveEngineUnavailableError,
  createAdaptiveClient,
  type DryRunRequest,
  type DryRunResponse,
} from '@klicker-uzh/adaptive-client'
import { isValidAdaptiveLevelReachedFrom } from '@klicker-uzh/adaptive-contract'
import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import * as DB from '@klicker-uzh/prisma/client'
import {
  summarizeAdaptiveDryRun,
  summarizeAdaptiveDryRunSubcompetences,
  toAdaptiveDryRunStudent,
} from './adaptivePracticeQuizDryRunSummary.js'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import {
  adaptiveEngineGraphQLError,
  buildAdaptiveDecisionRequest,
} from './adaptivePracticeQuizEstimatorVersions.js'
import {
  type LoadedAdaptiveRuntime,
  loadAdaptiveRuntime,
} from './adaptivePracticeQuizRuntimeData.js'
import { isAdaptiveTestingInfoEnabled } from './adaptivePracticeQuizTestingInfo.js'
import { isAdaptiveUniqueConstraintConflict } from './adaptiveTransactions.js'

/**
 * Dry runs: simulated students run through the engine against the current
 * publication of an IRT_V1 quiz, with optional stop-setting overrides. Only
 * where ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true (staging, local), like the attempt
 * check. Callers are authorized by the GraphQL field (asUser + ADMIN
 * permission on the quiz). Runs never touch attempts, results, exposure
 * counts or calibration data.
 */

export type AdaptiveDryRunInput = {
  students: number
  noiseProbability: number
  fromLevelId: number
  toLevelId: number
  competences: 'SAME_LEVEL' | 'INDEPENDENT'
  answerModel?: string | null
  seed?: string | null
  totalQuestionCap: number
  minQuestionsPerLeaf: number
  classificationZ: number
  classificationToleranceBands: number
  levelReachedFrom: number
}

export type AdaptiveDryRunRecord = Pick<
  DB.AdaptivePracticeQuizDryRun,
  | 'id'
  | 'number'
  | 'publicationId'
  | 'engineRevision'
  | 'durationMs'
  | 'spec'
  | 'effectiveSettings'
  | 'summary'
  | 'createdAt'
> & { students: PrismaJson.PrismaAdaptiveDryRunStudents | null }

export type AdaptiveDryRunWorkspace = {
  available: boolean
  /** Why no dry run can start, e.g. no IRT_V1 publication. */
  unavailableReason: string | null
  publicationId: string | null
  levels: Array<{ id: number; label: string; order: number }>
  competences: Array<{ nodeId: number; name: string }>
  subcompetences: Array<{ nodeId: number; rootId: number; name: string }>
  items: Array<{
    poolItemId: number
    elementName: string
    levelId: number
    rootId: number
    nodeNames: string[]
  }>
  defaults: PrismaJson.PrismaAdaptiveDryRunSettings | null
  /** Level bands of the publication, for presentation (positions, hints). */
  scale: {
    thetaMin: number
    thetaMax: number
    levelMappingRule: string
  } | null
  maxStudents: number
  maxDecisions: number
  runs: AdaptiveDryRunRecord[]
}

// Tries to number a finished run before giving up on concurrent clashes.
const RUN_NUMBER_ATTEMPTS = 3

const runSelect = {
  id: true,
  number: true,
  publicationId: true,
  engineRevision: true,
  durationMs: true,
  spec: true,
  effectiveSettings: true,
  summary: true,
  createdAt: true,
} satisfies DB.Prisma.AdaptivePracticeQuizDryRunSelect

function levelsOf(runtime: LoadedAdaptiveRuntime) {
  return runtime.algorithm.levels
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(({ id, label, order }) => ({ id, label, order }))
}

function scaleOf(runtime: LoadedAdaptiveRuntime) {
  return {
    thetaMin: runtime.algorithm.settings.thetaRange.min,
    thetaMax: runtime.algorithm.settings.thetaRange.max,
    levelMappingRule: runtime.algorithm.settings.levelMappingRule,
  }
}

function settingsOf(
  runtime: LoadedAdaptiveRuntime
): PrismaJson.PrismaAdaptiveDryRunSettings {
  const settings = runtime.algorithm.settings
  return {
    totalQuestionCap: settings.totalQuestionCap,
    minQuestionsPerLeaf: settings.minQuestionsPerLeaf,
    classificationZ: settings.classificationZ,
    classificationToleranceBands:
      'classificationToleranceBands' in settings
        ? (settings.classificationToleranceBands ?? 0)
        : 0,
    // The quiz's mastery mark ("mastered from"), not a band shift.
    levelReachedFrom: runtime.masteryFrom,
  }
}

async function loadIrtV1Runtime(practiceQuizId: string, ctx: ContextWithUser) {
  let runtime: LoadedAdaptiveRuntime
  try {
    runtime = await loadAdaptiveRuntime(ctx.prisma, practiceQuizId, {
      includeAlgorithmData: true,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      'extensions' in error &&
      (error.extensions as { code?: string }).code ===
        'ADAPTIVE_QUIZ_UNAVAILABLE'
    )
      return null
    throw error
  }
  return runtime.estimator.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V1
    ? runtime
    : null
}

export async function getAdaptivePracticeQuizDryRuns(
  { practiceQuizId }: { practiceQuizId: string },
  ctx: ContextWithUser,
  showSolutions: string | undefined = process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS
): Promise<AdaptiveDryRunWorkspace | null> {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) return null
  const [runtime, runs] = await Promise.all([
    loadIrtV1Runtime(practiceQuizId, ctx),
    ctx.prisma.adaptivePracticeQuizDryRun.findMany({
      where: { practiceQuizId },
      select: runSelect,
      orderBy: { number: 'desc' },
    }),
  ])
  const nodeNames = new Map(
    runtime?.publication.hierarchicalWeightSnapshot.map(({ nodeId, name }) => [
      nodeId,
      name,
    ]) ?? []
  )
  return {
    available: runtime !== null,
    unavailableReason: runtime === null ? 'NO_IRT_V1_PUBLICATION' : null,
    publicationId: runtime?.publication.id ?? null,
    levels: runtime ? levelsOf(runtime) : [],
    competences:
      runtime?.algorithm.nodes
        .filter(({ parentId, enabled }) => parentId === null && enabled)
        .map(({ id }) => ({
          nodeId: id,
          name: nodeNames.get(id) ?? `#${id}`,
        })) ?? [],
    subcompetences: runtime
      ? dryRunLeaves(runtime).map(({ nodeId, rootId }) => ({
          nodeId,
          rootId,
          name: nodeNames.get(nodeId) ?? `#${nodeId}`,
        }))
      : [],
    items:
      runtime?.publishedPool.map((item) => ({
        poolItemId: item.id,
        elementName: item.elementName,
        levelId: item.levelId,
        rootId: item.nodePath[0]!,
        nodeNames: [...item.nodeNamePath],
      })) ?? [],
    defaults: runtime ? settingsOf(runtime) : null,
    scale: runtime ? scaleOf(runtime) : null,
    maxStudents: ADAPTIVE_DRY_RUN_MAX_STUDENTS,
    maxDecisions: ADAPTIVE_DRY_RUN_MAX_DECISIONS,
    runs: runs.map((run) => ({ ...run, students: null })),
  }
}

export async function getAdaptivePracticeQuizDryRun(
  { practiceQuizId, id }: { practiceQuizId: string; id: string },
  ctx: ContextWithUser,
  showSolutions: string | undefined = process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS
): Promise<AdaptiveDryRunRecord | null> {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) return null
  return await ctx.prisma.adaptivePracticeQuizDryRun.findFirst({
    where: { id, practiceQuizId },
    select: { ...runSelect, students: true },
  })
}

export async function deleteAdaptivePracticeQuizDryRun(
  { practiceQuizId, id }: { practiceQuizId: string; id: string },
  ctx: ContextWithUser,
  showSolutions: string | undefined = process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS
): Promise<boolean | null> {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) return null
  const { count } = await ctx.prisma.adaptivePracticeQuizDryRun.deleteMany({
    where: { id, practiceQuizId },
  })
  return count > 0
}

/** Enabled leaves (subcompetences) with their root competence. */
function dryRunLeaves(runtime: LoadedAdaptiveRuntime) {
  const nodes = runtime.algorithm.nodes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const parents = new Set(nodes.map(({ parentId }) => parentId))
  const rootOf = (id: number): number => {
    const parentId = byId.get(id)?.parentId ?? null
    return parentId === null ? id : rootOf(parentId)
  }
  const enabledPath = (id: number): boolean => {
    const node = byId.get(id)
    if (!node?.enabled) return false
    return node.parentId === null || enabledPath(node.parentId)
  }
  // Tree order (depth first, siblings by order), as in the tree editor.
  const children = (parentId: number | null) =>
    nodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => a.order - b.order)
  const ordered: typeof nodes = []
  const visit = (parentId: number | null) => {
    for (const node of children(parentId)) {
      ordered.push(node)
      visit(node.id)
    }
  }
  visit(null)
  return ordered
    .filter(
      ({ id, parentId }) =>
        parentId !== null && !parents.has(id) && enabledPath(id)
    )
    .map(({ id }) => ({ nodeId: id, rootId: rootOf(id) }))
}

function invalidInput(message: string) {
  return adaptivePracticeQuizError(message, 'ADAPTIVE_DRY_RUN_INVALID')
}

const SEED_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/** A short random seed that people can read, note and type again. */
export function randomAdaptiveDryRunSeed() {
  return String(randomInt(100_000, 1_000_000))
}

/**
 * The engine's seed: 64 hexadecimal characters. Seeds of earlier runs already
 * have that form and pass unchanged; any other seed is hashed.
 */
export function adaptiveDryRunEngineSeed(seed: string) {
  return /^[a-f0-9]{64}$/.test(seed)
    ? seed
    : createHash('sha256').update(seed).digest('hex')
}

/** Validates the form input and builds the engine spec and settings. */
export function buildAdaptiveDryRunSpec(
  input: AdaptiveDryRunInput,
  levels: ReadonlyArray<{ id: number; order: number }>,
  seed = input.seed?.trim() || randomAdaptiveDryRunSeed()
) {
  const isInt = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max
  if (!isInt(input.students, 1, ADAPTIVE_DRY_RUN_MAX_STUDENTS))
    throw invalidInput(
      `Choose between 1 and ${ADAPTIVE_DRY_RUN_MAX_STUDENTS} students.`
    )
  if (
    !Number.isFinite(input.noiseProbability) ||
    input.noiseProbability < 0 ||
    input.noiseProbability > 0.5
  )
    throw invalidInput('The noise must lie between 0% and 50%.')
  if (!SEED_PATTERN.test(seed))
    throw invalidInput(
      'The seed may have up to 64 letters, digits, hyphens and underscores.'
    )
  if (!isInt(input.totalQuestionCap, 1, 1000))
    throw invalidInput('The question cap must lie between 1 and 1000.')
  if (input.students * input.totalQuestionCap > ADAPTIVE_DRY_RUN_MAX_DECISIONS)
    throw invalidInput(
      `Students × maximum questions may not exceed ${ADAPTIVE_DRY_RUN_MAX_DECISIONS}.`
    )
  if (!isInt(input.minQuestionsPerLeaf, 0, input.totalQuestionCap))
    throw invalidInput(
      'The minimum per subcompetence must lie between 0 and the question cap.'
    )
  if (
    !Number.isFinite(input.classificationZ) ||
    input.classificationZ <= 0 ||
    input.classificationZ > 10
  )
    throw invalidInput('The confidence value is invalid.')
  if (!isInt(input.classificationToleranceBands, 0, 5))
    throw invalidInput('The classification precision is invalid.')
  if (!isValidAdaptiveLevelReachedFrom(input.levelReachedFrom))
    throw invalidInput('“Level reached from” must lie between 0% and 95%.')
  if (input.competences !== 'SAME_LEVEL' && input.competences !== 'INDEPENDENT')
    throw invalidInput('The competence mode is invalid.')
  const answerModel = input.answerModel ?? 'IDEAL'
  if (answerModel !== 'IDEAL' && answerModel !== 'REALISTIC')
    throw invalidInput('The answer model is invalid.')
  const order = new Map(levels.map(({ id, order }) => [id, order]))
  const from = order.get(input.fromLevelId)
  const to = order.get(input.toLevelId)
  if (from === undefined || to === undefined || from > to)
    throw invalidInput('Choose a valid level range.')

  const realistic = answerModel === 'REALISTIC'
  const spec: PrismaJson.PrismaAdaptiveDryRunSpec = {
    students: input.students,
    seed,
    // Realistic answers carry their own randomness; noise does not apply.
    noiseProbability: realistic ? 0 : input.noiseProbability,
    trueLevels:
      input.fromLevelId === input.toLevelId
        ? { kind: 'FIXED', levelId: input.fromLevelId }
        : {
            kind: 'EVEN',
            fromLevelId: input.fromLevelId,
            toLevelId: input.toLevelId,
          },
    competences: input.competences,
    // Ideal students sit in the middle of their level, as reported levels
    // use the plain bands: their own level is answered right and wrong in
    // turn instead of all right (which puts them on the border above).
    ...(realistic
      ? { answerModel: 'REALISTIC' as const }
      : { idealOwnLevel: 'HALF' as const }),
  }
  const settings: PrismaJson.PrismaAdaptiveDryRunSettings = {
    totalQuestionCap: input.totalQuestionCap,
    minQuestionsPerLeaf: input.minQuestionsPerLeaf,
    classificationZ: input.classificationZ,
    classificationToleranceBands: input.classificationToleranceBands,
    levelReachedFrom: input.levelReachedFrom,
    masteryMark: true,
  }
  return { spec, settings }
}

/** The engine request: the publication snapshot with the run's overrides. */
export function buildAdaptiveDryRunRequest(
  runtime: LoadedAdaptiveRuntime,
  spec: PrismaJson.PrismaAdaptiveDryRunSpec,
  settings: PrismaJson.PrismaAdaptiveDryRunSettings
): DryRunRequest {
  const request = buildAdaptiveDecisionRequest({
    attemptId: '00000000-0000-4000-8000-000000000000',
    runtime: runtime.estimator,
    responses: [],
  })
  if (request.measurementVersion !== 'IRT_V1')
    throw adaptivePracticeQuizError(
      'Dry runs support IRT v1 quizzes only.',
      'ADAPTIVE_DRY_RUN_UNSUPPORTED'
    )
  const {
    routingSeed: _routingSeed,
    responses: _responses,
    terminalStopReason: _terminalStopReason,
    retake: _retake,
    settings: published,
    ...snapshot
  } = request
  const {
    classificationToleranceBands: _tolerance,
    levelReachedFrom: _reachedFrom,
    ...base
  } = published
  return {
    ...snapshot,
    settings: {
      ...base,
      totalQuestionCap: settings.totalQuestionCap,
      minQuestionsPerLeaf: settings.minQuestionsPerLeaf,
      classificationZ: settings.classificationZ,
      // Only above 0, as for publications, so older engines accept the rest.
      ...(settings.classificationToleranceBands > 0
        ? {
            classificationToleranceBands: settings.classificationToleranceBands,
          }
        : {}),
      // The run's "mastered from" share is a mastery mark for presentation
      // only, so the engine always uses the plain bands.
    },
    dryRun: { ...spec, seed: adaptiveDryRunEngineSeed(spec.seed) },
  }
}

export async function runAdaptivePracticeQuizDryRun(
  {
    practiceQuizId,
    input,
  }: { practiceQuizId: string; input: AdaptiveDryRunInput },
  ctx: ContextWithUser,
  {
    showSolutions = process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS,
    runEngine = defaultEngineRunner,
    now = () => Date.now(),
  }: {
    showSolutions?: string | undefined
    runEngine?: (request: DryRunRequest) => Promise<DryRunResponse>
    now?: () => number
  } = {}
): Promise<AdaptiveDryRunRecord | null> {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) return null
  const runtime = await loadIrtV1Runtime(practiceQuizId, ctx)
  if (!runtime)
    throw adaptivePracticeQuizError(
      'Publish the adaptive practice quiz (IRT v1) before starting a dry run.',
      'ADAPTIVE_DRY_RUN_UNAVAILABLE'
    )
  const { spec, settings } = buildAdaptiveDryRunSpec(
    input,
    runtime.algorithm.levels
  )
  const request = buildAdaptiveDryRunRequest(runtime, spec, settings)
  const startedAt = now()
  const parts = splitAdaptiveDryRunRequest(request)
  const responses: DryRunResponse[] = []
  // Two parts at a time leave engine workers free for real attempts.
  for (let i = 0; i < parts.length; i += DRY_RUN_PARALLEL_PARTS)
    responses.push(
      ...(await Promise.all(
        parts.slice(i, i + DRY_RUN_PARALLEL_PARTS).map(runEngine)
      ))
    )
  const durationMs = Math.max(0, Math.round(now() - startedAt))
  const students = responses
    .flatMap((response) => response.students)
    .map(toAdaptiveDryRunStudent)
  const summary = {
    ...summarizeAdaptiveDryRun({
      students,
      levels: runtime.algorithm.levels,
      poolSize: runtime.algorithm.pool.length,
    }),
    subcompetences: summarizeAdaptiveDryRunSubcompetences({
      students,
      levels: runtime.algorithm.levels,
      leaves: dryRunLeaves(runtime),
      pool: runtime.algorithm.pool,
    }),
    scale: { ...scaleOf(runtime), levels: levelsOf(runtime) },
  }

  // Run numbers count up per quiz. Two runs finishing together can pick the
  // same number; the unique key rejects the second, which then takes the
  // next one instead of losing its finished work.
  for (let attempt = 1; ; attempt += 1) {
    const latest = await ctx.prisma.adaptivePracticeQuizDryRun.findFirst({
      where: { practiceQuizId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    try {
      return await ctx.prisma.adaptivePracticeQuizDryRun.create({
        data: {
          practiceQuizId,
          publicationId: runtime.publication.id,
          createdById: ctx.user.sub,
          number: (latest?.number ?? 0) + 1,
          engineRevision: process.env.ADAPTIVE_ENGINE_REVISION || null,
          durationMs,
          spec,
          effectiveSettings: settings,
          summary,
          students,
        },
        select: { ...runSelect, students: true },
      })
    } catch (error) {
      if (
        !isAdaptiveUniqueConstraintConflict(error) ||
        attempt >= RUN_NUMBER_ATTEMPTS
      )
        throw error
    }
  }
}

// Decision cost grows with the tree and pool (200 x 100 on a 1,200-item,
// 60-subcompetence tree takes ~17 s), so a run is sent in parts that stay well
// inside the engine's 10 s worker deadline. Parts number their students from
// `firstStudent`, so the result equals one unsplit run.
const DRY_RUN_DECISIONS_PER_PART = 2500
const DRY_RUN_PARALLEL_PARTS = 2

export function splitAdaptiveDryRunRequest(
  request: DryRunRequest
): DryRunRequest[] {
  const perPart = Math.max(
    1,
    Math.floor(DRY_RUN_DECISIONS_PER_PART / request.settings.totalQuestionCap)
  )
  const parts: DryRunRequest[] = []
  for (let first = 0; first < request.dryRun.students; first += perPart)
    parts.push({
      ...request,
      dryRun: {
        ...request.dryRun,
        firstStudent: first,
        students: Math.min(perPart, request.dryRun.students - first),
      },
    })
  return parts
}

async function defaultEngineRunner(request: DryRunRequest) {
  const baseUrl = process.env.ADAPTIVE_ENGINE_URL
  const token = process.env.ADAPTIVE_ENGINE_TOKEN
  if (!baseUrl || !token)
    throw adaptivePracticeQuizError(
      'The adaptive calculation service is not configured.',
      'ADAPTIVE_ENGINE_UNAVAILABLE'
    )
  try {
    // A run is up to 20,000 decisions in one engine call (about 3 s at most).
    return await createAdaptiveClient({
      baseUrl,
      token,
      timeoutMs: 20000,
    }).dryRun(request)
  } catch (error) {
    if (error instanceof AdaptiveEngineUnavailableError) {
      if (error.overloaded) throw adaptiveEngineGraphQLError(error)
      throw adaptivePracticeQuizError(
        'The adaptive calculation service is unavailable or does not support dry runs yet.',
        'ADAPTIVE_DRY_RUN_ENGINE_UNAVAILABLE'
      )
    }
    throw error
  }
}
