import { createHash } from 'node:crypto'
import {
  extractCitationIndexes,
  extractCitationMarkerSpans,
  normalizeMarkdownContent,
} from './citations.js'
import { hasCompleteResponseExampleCitationParity } from './responseExampleEligibility.js'

export const RESPONSE_EXAMPLE_RUNTIME_CONTRACT_VERSION = 1
export const RESPONSE_EXAMPLE_SUMMARY_MAX_CHARACTERS = 1_500
export const RESPONSE_EXAMPLE_SEARCH_QUERY_MAX_CHARACTERS = 4_000
export const RESPONSE_EXAMPLE_SEARCH_MAX_ITEMS = 3
export const RESPONSE_EXAMPLE_SEARCH_MAX_CHARACTERS = 24_000

export type ResponseExampleSkillRole = 'included' | 'excluded'

export interface ResponseExampleRuntimeExample {
  id: string
  responseStyle: string
}

export interface ResponseExampleSearchEvidence {
  citationIndex: number
  sourceId: string
  chunkId: string
  contentHash: string
  citationAnchor: string
}

export interface ResponseExampleSearchCandidate
  extends ResponseExampleRuntimeExample {
  studentMessage: string
  referenceAnswer: string
  evidenceReferences: readonly ResponseExampleSearchEvidence[]
}

export interface ResponseExampleSearchResult {
  degraded: boolean
  examples: ResponseExampleSearchProjection[]
}

export interface ResponseExampleSearchProjection
  extends ResponseExampleRuntimeExample {
  studentMessage: string
  referenceAnswer: string
  sourceAnchors: { citationIndex: number; citationAnchor: string }[]
}

export function computeResponseExampleSkillProjectionDigest(args: {
  role: ResponseExampleSkillRole
  chatbotId: string
  chatMode: string
  summary: string
  setDigest: string | null
}) {
  const canonical = {
    contractVersion: RESPONSE_EXAMPLE_RUNTIME_CONTRACT_VERSION,
    role: args.role,
    chatbotId: args.chatbotId,
    chatMode: args.chatMode,
    summary: args.summary,
    setDigest: args.role === 'included' ? args.setDigest : null,
  }

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function compareStrings(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function humanizeResponseStyle(style: string) {
  return style
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ')
}

export function buildResponseExampleSummary(
  examples: readonly ResponseExampleRuntimeExample[]
) {
  if (examples.length === 0) {
    return [
      'Response-example skill',
      'No lecturer-approved response examples are currently available for this chatbot and mode.',
      'Do not call search_response_examples unless this summary reports available examples.',
    ].join('\n')
  }

  const styleCounts = new Map<string, number>()
  for (const example of examples) {
    styleCounts.set(
      example.responseStyle,
      (styleCounts.get(example.responseStyle) ?? 0) + 1
    )
  }

  const styleSummary = [...styleCounts.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([style, count]) => `${humanizeResponseStyle(style)}: ${count}`)
    .join(', ')
  const summary = [
    'Response-example skill',
    `${examples.length} lecturer-approved response ${examples.length === 1 ? 'example is' : 'examples are'} available for this chatbot and mode.`,
    `Response approaches: ${styleSummary}.`,
    'Call search_response_examples with the current question when an example would help you match the lecturer-approved response approach. Examples teach behavior and structure only. For current factual claims, use the current knowledge tools and their sources.',
  ].join('\n')

  return summary.slice(0, RESPONSE_EXAMPLE_SUMMARY_MAX_CHARACTERS)
}

export function buildResponseExampleSkillProjection(args: {
  role: ResponseExampleSkillRole
  examples: readonly ResponseExampleRuntimeExample[]
}) {
  return {
    summary:
      args.role === 'included'
        ? buildResponseExampleSummary(args.examples)
        : '',
    searchEnabled: args.role === 'included',
  }
}

export function rewriteResponseExampleCitations(answer: string) {
  const normalizedAnswer = normalizeMarkdownContent(answer)
  const spans = extractCitationMarkerSpans(answer)
  if (spans.length === 0) return normalizedAnswer

  let result = normalizedAnswer
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index]!
    result = `${result.slice(0, span.start)}[example-source-${span.citationIndex}]${result.slice(span.end)}`
  }

  return result
}

export function boundResponseExampleSearchResults(
  candidates: readonly ResponseExampleSearchCandidate[]
): ResponseExampleSearchProjection[] {
  const selected: ResponseExampleSearchProjection[] = []

  for (const candidate of candidates) {
    if (selected.length >= RESPONSE_EXAMPLE_SEARCH_MAX_ITEMS) break
    if (!hasCompleteResponseExampleCitationParity(candidate)) continue

    const referenceAnswer = rewriteResponseExampleCitations(
      candidate.referenceAnswer
    )
    if (extractCitationIndexes(referenceAnswer).length > 0) continue

    const projected: ResponseExampleSearchProjection = {
      id: candidate.id,
      responseStyle: candidate.responseStyle,
      studentMessage: candidate.studentMessage,
      referenceAnswer,
      sourceAnchors: candidate.evidenceReferences.map((reference) => ({
        citationIndex: reference.citationIndex,
        citationAnchor: reference.citationAnchor,
      })),
    }
    const projectedCharacters = JSON.stringify({
      degraded: false,
      examples: [...selected, projected],
    }).length
    if (projectedCharacters > RESPONSE_EXAMPLE_SEARCH_MAX_CHARACTERS) {
      continue
    }

    selected.push(projected)
  }

  return selected
}
