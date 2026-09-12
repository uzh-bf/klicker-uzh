export type QuestionGenerationArtifactRef = {
  containerName: string
  blobName: string
  sha256: string
}

export type KBGraphSourceSnapshotItem = {
  resourceId: string
  title: string
  sourceFile: string
  contentSha256: string
  resourceVersion: number
  pageCount: number | null
}

export type KBGraphSourceSnapshot = KBGraphSourceSnapshotItem[]

export type QuestionGenerationLanguage = 'de' | 'en'
export type QuestionGenerationItemType = 'SC' | 'MC' | 'KPRIM'
export type QuestionGenerationBloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
export type QuestionGenerationDifficultyPreset =
  | 'D1'
  | 'D2'
  | 'D3'
  | 'D4'
  | 'D5'
  | 'EASY'
  | 'MIXED'
  | 'HARD'
export type QuestionGenerationDifficultyCounts = {
  d1: number
  d2: number
  d3: number
  d4: number
  d5: number
}

const QUESTION_GENERATION_DIFFICULTY_KEYS = [
  'd1',
  'd2',
  'd3',
  'd4',
  'd5',
] as const
const QUESTION_GENERATION_DIFFICULTY_WEIGHTS = {
  D1: [100, 0, 0, 0, 0],
  D2: [0, 100, 0, 0, 0],
  D3: [0, 0, 100, 0, 0],
  D4: [0, 0, 0, 100, 0],
  D5: [0, 0, 0, 0, 100],
  EASY: [40, 40, 20, 0, 0],
  MIXED: [10, 25, 30, 25, 10],
  HARD: [0, 0, 20, 40, 40],
} as const satisfies Record<
  QuestionGenerationDifficultyPreset,
  readonly [number, number, number, number, number]
>

export function allocateQuestionGenerationDifficulty(
  count: number,
  preset: QuestionGenerationDifficultyPreset
): QuestionGenerationDifficultyCounts {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('Question count must be an integer from 1 to 20')
  }

  const shares = QUESTION_GENERATION_DIFFICULTY_WEIGHTS[preset].map(
    (weight, index) => {
      const raw = (count * weight) / 100
      const base = Math.floor(raw)
      return { index, base, remainder: raw - base }
    }
  )
  let remaining = count - shares.reduce((sum, share) => sum + share.base, 0)

  for (const share of [...shares].sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index
  )) {
    if (remaining === 0) break
    share.base += 1
    remaining -= 1
  }

  return Object.fromEntries(
    shares.map((share, index) => [
      QUESTION_GENERATION_DIFFICULTY_KEYS[index],
      share.base,
    ])
  ) as QuestionGenerationDifficultyCounts
}

export type QuestionGenerationConfiguration = {
  itemType: QuestionGenerationItemType
  language: QuestionGenerationLanguage
  questionCount: number
  difficultyPreset: QuestionGenerationDifficultyPreset
  difficultyCounts: QuestionGenerationDifficultyCounts
  sourceScopes: Array<{
    resourceId: string
    pageFrom: number | null
    pageTo: number | null
  }>
  objectives: Array<{
    id: string
    text: string
    bloomLevel: QuestionGenerationBloomLevel | null
  }>
  bloomLevels: QuestionGenerationBloomLevel[]
}

export type GeneratedQuestionCitation = {
  resourceId: string
  sourceFile: string
  pageFrom: number | null
  pageTo: number | null
  chunkIds: string[]
}

export type QuestionGenerationSourceProvenanceCitation = {
  elementType: 'node' | 'relationship'
  elementId: string
  chunkIds: string[]
  sourcePages: string[]
  lectureMarkers: string[]
}

export type QuestionGenerationAssertionProvenanceCitation = {
  assertionId: string
  version: number
}

export type QuestionGenerationQuestionProvenance = {
  schemaVersion: 1
  lineageStatus: 'complete' | 'legacy_incomplete'
  graphVersionId: string | null
  bundleSha256: string | null
  graphSha256: string | null
  domainPolicyDigest: string | null
  generationRecipeDigest: string | null
  nodeIds: string[]
  relationshipIds: string[]
  sourceCitations: QuestionGenerationSourceProvenanceCitation[]
  assertionCitations: QuestionGenerationAssertionProvenanceCitation[]
}

export type QuestionGenerationProvenanceIndex = {
  schemaVersion: 1
  questionIds: string[]
  byNodeId: Record<string, string[]>
  byRelationshipId: Record<string, string[]>
  byAssertionId: Record<string, string[]>
  bySourceRef: Record<string, string[]>
}

export type GeneratedQuestionEditable = {
  itemType: QuestionGenerationItemType
  name: string
  stem: string
  context: string | null
  explanation: string | null
  choices: Array<{
    id: string
    label: string
    text: string
    correct: boolean
    feedback: string | null
  }>
  tagSelection?: GeneratedQuestionTagSelection
}

// Requested tag selection for a generated question draft. `existingTagIds`
// references tags of the reviewing owner by id; `newTagNames` are proposals
// that are only created with a successful save. This is the requested intent,
// not the resolved tag set, so an identical retry stays an exact retry after a
// proposal has become an existing tag.
export type GeneratedQuestionTagSelection = {
  existingTagIds: number[]
  newTagNames: string[]
}

// Input form of a selection as it arrives over GraphQL. Either list may be
// omitted or null and is then treated as empty; normalization validates and
// deduplicates the arrived values.
export type GeneratedQuestionTagSelectionInput = {
  existingTagIds?: number[] | null
  newTagNames?: string[] | null
}

export type GeneratedQuestionOriginal = GeneratedQuestionEditable & {
  suggestedTags?: string[]
  sourceQuestionId: string
  bloomLevel: QuestionGenerationBloomLevel
  targetDifficulty: number
  predictedDifficulty: number | null
  qualityFlags: string[]
  citations: GeneratedQuestionCitation[]
}

export type GeneratedQuestionWithProvenance = GeneratedQuestionOriginal & {
  provenance: QuestionGenerationQuestionProvenance | null
}

export type QuestionGenerationWarning = {
  code: string
  message: string
}

export type QuestionGenerationReviewSourceSummary = {
  sourceFile: string
  pageFrom: number | null
  pageTo: number | null
}

export type QuestionGenerationDesignModuleSummary = {
  moduleId: string
  moduleName: string
  questionCount: number
}

export type QuestionGenerationDesignSlotSummary = {
  sourceQuestionId: string
  moduleId: string
  objectiveId: string | null
  bloomLevel: QuestionGenerationBloomLevel | null
  targetDifficulty: number
}

export type QuestionGenerationDesignSummary = {
  title: string
  questionCount: number
  objectives: Array<{
    id: string
    text: string
    bloomLevel: QuestionGenerationBloomLevel | null
  }>
  modules: QuestionGenerationDesignModuleSummary[]
  sources: QuestionGenerationReviewSourceSummary[]
  slots: QuestionGenerationDesignSlotSummary[]
  warnings: QuestionGenerationWarning[]
}

export type QuestionGenerationPlanSummary = {
  questionCount: number
  questions: Array<{
    sourceQuestionId: string
    moduleId: string
    objectiveId: string | null
    stem: string
    bloomLevel: QuestionGenerationBloomLevel
    targetDifficulty: number
    sources: QuestionGenerationReviewSourceSummary[]
  }>
  warnings: QuestionGenerationWarning[]
}

export const QUESTION_GENERATION_CAPABILITIES = {
  itemTypes: ['SC', 'MC', 'KPRIM'],
  languages: ['de', 'en'],
  bloomLevels: ['remember', 'understand', 'apply', 'analyze', 'evaluate'],
  difficultyLevels: [1, 2, 3, 4, 5],
  requiresDesignReview: true,
  requiresPlanReview: true,
  supportsIndividualRegeneration: false,
} as const

export type GeneratedQuestionTagCandidate = {
  id: number
  name: string
}

export type GeneratedQuestionTagMatch = {
  existingTagIds: number[]
  newTagNames: string[]
}

const MAX_GENERATED_QUESTION_TAG_MATCHES = 5
const TOKEN_OVERLAP_THRESHOLD = 0.5
const MIN_SHARED_TOKEN_LENGTH = 3

export function normalizeGeneratedQuestionTagLabel(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

function generatedQuestionTagKey(value: string): string {
  return normalizeGeneratedQuestionTagLabel(value).toLocaleLowerCase()
}

function generatedQuestionTagTokens(value: string): string[] {
  return generatedQuestionTagKey(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

// Conservative token overlap: at least one shared token of three or more
// characters and strictly more than half of the union's tokens shared, counting
// every token once no matter how often it repeats. Weak matches are dropped
// instead of filling a suggestion quota.
function conservativeTokenOverlap(
  left: string[],
  right: string[]
): number | null {
  if (left.length === 0 || right.length === 0) return null
  const leftTokens = new Set(left)
  const rightTokens = new Set(right)
  const shared = [...leftTokens].filter((token) => rightTokens.has(token))
  if (
    shared.length === 0 ||
    !shared.some((token) => token.length >= MIN_SHARED_TOKEN_LENGTH)
  ) {
    return null
  }
  const union = new Set([...leftTokens, ...rightTokens]).size
  const score = shared.length / union
  return score > TOKEN_OVERLAP_THRESHOLD ? score : null
}

// Ranks advisory generation labels against the reviewing owner's tags: exact
// name first, then case/whitespace-normalized, then conservative token overlap.
// Returns at most five existing recommendations and five new proposals and
// never preselects them. Matching is advisory only and never merges tags.
export function suggestGeneratedQuestionTags(
  suggestedTags: readonly string[],
  existingTags: readonly GeneratedQuestionTagCandidate[]
): GeneratedQuestionTagMatch {
  const exactMatches = new Map<string, GeneratedQuestionTagCandidate>()
  for (const tag of existingTags) {
    const label = normalizeGeneratedQuestionTagLabel(tag.name)
    if (label && !exactMatches.has(label)) exactMatches.set(label, tag)
  }

  const ranked: Array<{
    rank: number
    index: number
    tag: GeneratedQuestionTagCandidate
  }> = []
  const proposals: Array<{ index: number; label: string }> = []

  suggestedTags.forEach((suggestion, index) => {
    if (typeof suggestion !== 'string') return
    const label = normalizeGeneratedQuestionTagLabel(suggestion)
    if (!label) return

    const exact = exactMatches.get(label)
    if (exact) {
      ranked.push({ rank: 0, index, tag: exact })
      return
    }

    const key = generatedQuestionTagKey(label)
    const normalized = existingTags.find(
      (tag) => generatedQuestionTagKey(tag.name) === key
    )
    if (normalized) {
      ranked.push({ rank: 1, index, tag: normalized })
      return
    }

    const tokens = generatedQuestionTagTokens(label)
    let best: { score: number; tag: GeneratedQuestionTagCandidate } | null =
      null
    for (const tag of existingTags) {
      const score = conservativeTokenOverlap(
        tokens,
        generatedQuestionTagTokens(tag.name)
      )
      if (score === null) continue
      if (!best || score > best.score) best = { score, tag }
    }
    if (best) {
      ranked.push({ rank: 2, index, tag: best.tag })
      return
    }

    proposals.push({ index, label })
  })

  const existingTagIds: number[] = []
  for (const entry of ranked.sort(
    (left, right) => left.rank - right.rank || left.index - right.index
  )) {
    if (existingTagIds.length === MAX_GENERATED_QUESTION_TAG_MATCHES) break
    if (existingTagIds.includes(entry.tag.id)) continue
    existingTagIds.push(entry.tag.id)
  }

  const newTagNames: string[] = []
  const proposedKeys = new Set<string>()
  for (const proposal of proposals) {
    if (newTagNames.length === MAX_GENERATED_QUESTION_TAG_MATCHES) break
    const key = generatedQuestionTagKey(proposal.label)
    if (proposedKeys.has(key)) continue
    if (existingTags.some((tag) => generatedQuestionTagKey(tag.name) === key)) {
      continue
    }
    proposedKeys.add(key)
    newTagNames.push(proposal.label)
  }

  return { existingTagIds, newTagNames }
}
