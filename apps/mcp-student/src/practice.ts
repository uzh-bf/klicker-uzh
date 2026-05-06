import type {
  Candidate,
  PracticeQuiz,
  PracticeStack,
  QuestionRefPayload,
  SafeStackRenderPayload,
  StackResponseInput,
  SupportedElementType,
} from './types.js'
import { SUPPORTED_ELEMENT_TYPES } from './types.js'

export type RankPracticeStacksInput = {
  practiceQuiz: PracticeQuiz
  participantId: string
  chatbotId: string
  courseId: string
  query: string
  limit: number
  createQuestionRef: (payload: QuestionRefPayload) => string
}

const SUPPORTED_TYPE_SET = new Set<string>(SUPPORTED_ELEMENT_TYPES)

function isSupportedElementType(type: string): type is SupportedElementType {
  return SUPPORTED_TYPE_SET.has(type)
}

function orderedElements(stack: PracticeStack) {
  return [...(stack.elements ?? [])].sort((a, b) => a.id - b.id)
}

export function toSupportedElementTypes(
  stack: PracticeStack
): SupportedElementType[] {
  const types = new Set<SupportedElementType>()

  for (const element of orderedElements(stack)) {
    if (!isSupportedElementType(element.elementType)) {
      continue
    }
    types.add(element.elementType)
  }

  return [...types]
}

export function isSupportedStack(stack: PracticeStack): boolean {
  const elements = orderedElements(stack)
  return (
    elements.length > 0 &&
    elements.every((element) => isSupportedElementType(element.elementType))
  )
}

export function toQuestionRefPayload({
  participantId,
  chatbotId,
  courseId,
  stack,
}: {
  participantId: string
  chatbotId: string
  courseId: string
  stack: PracticeStack
}): QuestionRefPayload {
  if (!isSupportedStack(stack)) {
    throw new Error(`Stack ${stack.id} contains unsupported element types`)
  }

  return {
    participantId,
    chatbotId,
    courseId,
    stackId: stack.id,
    orderedElements: orderedElements(stack).map((element) => ({
      instanceId: element.id,
      type: element.elementType as SupportedElementType,
    })),
  }
}

export function assertQuestionRefMatchesStack(
  ref: QuestionRefPayload,
  stack: PracticeStack
): void {
  const current = toQuestionRefPayload({
    participantId: ref.participantId,
    chatbotId: ref.chatbotId,
    courseId: ref.courseId,
    stack,
  })

  if (JSON.stringify(current) !== JSON.stringify(ref)) {
    throw new Error('questionRef no longer matches the practice stack')
  }
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|[\](){}.,!?;:"'\\/-]/g, ' ')
}

function tokenize(value: string): string[] {
  return stripMarkdown(value)
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function stackText(stack: PracticeStack): string {
  const parts = [stack.displayName ?? '', stack.description ?? '']

  for (const element of orderedElements(stack)) {
    parts.push(element.elementData.name, element.elementData.content)
    const choices = element.elementData.options?.choices
    if (Array.isArray(choices)) {
      for (const choice of choices) {
        if (
          choice &&
          typeof choice === 'object' &&
          'value' in choice &&
          typeof choice.value === 'string'
        ) {
          parts.push(choice.value)
        }
      }
    }
  }

  return parts.join(' ')
}

function shortPreview(stack: PracticeStack): string {
  const firstElement = orderedElements(stack)[0]
  const raw = firstElement
    ? `${firstElement.elementData.name}: ${firstElement.elementData.content}`
    : stack.displayName || `Stack ${stack.id}`
  const normalized = stripMarkdown(raw).replace(/\s+/g, ' ').trim()
  return normalized.length > 240
    ? `${normalized.slice(0, 237).trimEnd()}...`
    : normalized
}

function scoreRelevance(stack: PracticeStack, queryTokens: Set<string>) {
  if (queryTokens.size === 0) {
    return { score: 0, matches: [] as string[] }
  }

  const stackTokens = new Set(tokenize(stackText(stack)))
  const matches = [...queryTokens].filter((token) => stackTokens.has(token))
  return {
    score: Number((matches.length / queryTokens.size).toFixed(4)),
    matches,
  }
}

function stackTitle(stack: PracticeStack): string {
  return stack.displayName?.trim() || `Stack ${stack.id}`
}

export function rankPracticeStacks({
  practiceQuiz,
  participantId,
  chatbotId,
  courseId,
  query,
  limit,
  createQuestionRef,
}: RankPracticeStacksInput): Candidate[] {
  const queryTokens = new Set(tokenize(query))

  return (practiceQuiz.stacks ?? [])
    .filter(isSupportedStack)
    .map((stack, index) => {
      const { score: relevanceScore, matches } = scoreRelevance(
        stack,
        queryTokens
      )
      const supportedElementTypes = toSupportedElementTypes(stack)
      const srsScore = Number((1 / (index + 1)).toFixed(4))

      return {
        questionRef: createQuestionRef(
          toQuestionRefPayload({
            participantId,
            chatbotId,
            courseId,
            stack,
          })
        ),
        stackTitle: stackTitle(stack),
        sourcePracticeQuizTitle: practiceQuiz.displayName,
        courseId,
        tags: [],
        supportedElementTypes,
        shortQuestionPreview: shortPreview(stack),
        relevanceScore,
        srsScore,
        reason:
          matches.length > 0
            ? `Matched ${matches.slice(0, 5).join(', ')}.`
            : 'No direct lexical match; included by spaced-repetition order.',
      }
    })
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore
      }
      return b.srsScore - a.srsScore
    })
    .slice(0, Math.max(0, limit))
}

function copyStringOption(
  source: Record<string, unknown>,
  key: string,
  target: Record<string, unknown>
): void {
  if (typeof source[key] === 'string') {
    target[key] = source[key]
  }
}

function copyNumberOption(
  source: Record<string, unknown>,
  key: string,
  target: Record<string, unknown>
): void {
  if (typeof source[key] === 'number') {
    target[key] = source[key]
  }
}

function safeOptionsForElement(
  elementType: SupportedElementType,
  options: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!options) return undefined

  if (['SC', 'MC', 'KPRIM'].includes(elementType)) {
    const safe: Record<string, unknown> = {}
    copyStringOption(options, 'displayMode', safe)

    if (Array.isArray(options.choices)) {
      safe.choices = options.choices
        .filter((choice) => choice && typeof choice === 'object')
        .map((choice) => {
          const record = choice as Record<string, unknown>
          return {
            ix: Number(record.ix),
            value: String(record.value ?? ''),
          }
        })
    }

    return safe
  }

  if (elementType === 'NUMERICAL') {
    const safe: Record<string, unknown> = {}
    copyNumberOption(options, 'accuracy', safe)
    copyStringOption(options, 'placeholder', safe)
    copyStringOption(options, 'unit', safe)
    if (options.restrictions && typeof options.restrictions === 'object') {
      const restrictions = options.restrictions as Record<string, unknown>
      safe.restrictions = {
        min:
          typeof restrictions.min === 'number' ? restrictions.min : undefined,
        max:
          typeof restrictions.max === 'number' ? restrictions.max : undefined,
      }
    }
    return safe
  }

  if (elementType === 'FREE_TEXT') {
    const safe: Record<string, unknown> = {}
    if (options.restrictions && typeof options.restrictions === 'object') {
      const restrictions = options.restrictions as Record<string, unknown>
      safe.restrictions = {
        maxLength:
          typeof restrictions.maxLength === 'number'
            ? restrictions.maxLength
            : undefined,
      }
    }
    return safe
  }

  return undefined
}

export function toSafeStackRenderPayload(
  stack: PracticeStack
): SafeStackRenderPayload {
  if (!isSupportedStack(stack)) {
    throw new Error(`Stack ${stack.id} contains unsupported element types`)
  }

  return {
    stackId: stack.id,
    stackTitle: stackTitle(stack),
    description: stack.description ?? undefined,
    elements: orderedElements(stack).map((element) => {
      const elementType = element.elementType as SupportedElementType
      return {
        instanceId: element.id,
        elementType,
        name: element.elementData.name,
        content: element.elementData.content,
        options: safeOptionsForElement(
          elementType,
          element.elementData.options
        ),
      }
    }),
  }
}

export function validateCompleteStackSubmission(
  ref: QuestionRefPayload,
  responses: StackResponseInput[]
): void {
  if (responses.length !== ref.orderedElements.length) {
    throw new Error('Submission must answer the complete stack')
  }

  const seen = new Set<number>()
  for (const response of responses) {
    if (seen.has(response.instanceId)) {
      throw new Error(`Duplicate response for instance ${response.instanceId}`)
    }
    seen.add(response.instanceId)
  }

  for (const expected of ref.orderedElements) {
    const response = responses.find(
      (candidate) => candidate.instanceId === expected.instanceId
    )

    if (!response) {
      throw new Error('Submission must answer the complete stack')
    }

    if (response.type !== expected.type) {
      throw new Error(
        `Response type mismatch for instance ${expected.instanceId}`
      )
    }
  }
}
