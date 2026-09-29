import * as DB from '@klicker-uzh/prisma/client'
import type {
  QuestionGenerationItemType,
  QuestionLibrarySnapshotQuestion,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { canonicalElementGenerationJson } from './elementGenerationProvider.js'
import { MAX_BUFFERED_QUESTION_GENERATION_ARTIFACT_BYTES } from './questionGenerationContracts.js'
import {
  QuestionGenerationServiceError,
  questionGenerationServiceError,
} from './questionGenerationErrors.js'

const MAX_LIBRARY_ELEMENTS = 500
const MAX_NAME_LENGTH = 500
const MAX_STEM_LENGTH = 50_000
const MAX_CHOICE_COUNT = 100
const MAX_CHOICE_TEXT_LENGTH = 10_000
const QUESTION_LIBRARY_ELEMENT_TYPES: DB.ElementType[] = [
  DB.ElementType.SC,
  DB.ElementType.MC,
  DB.ElementType.KPRIM,
]

type RuntimeEnvironment = Record<string, string | undefined>

type LibraryElement = {
  id: number
  version: number
  type: DB.ElementType
  name: string
  content: string
  options: PrismaJson.PrismaElementOptions
}

function configurationError(message: string): never {
  throw questionGenerationServiceError('CONFIGURATION_INVALID', message)
}

function boundedText(value: unknown, field: string, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    return configurationError(
      `Question-library ${field} must contain 1-${maxLength} characters`
    )
  }
  return value
}

function normalizeChoices(
  options: PrismaJson.PrismaElementOptions
): QuestionLibrarySnapshotQuestion['choices'] {
  if (
    typeof options !== 'object' ||
    options === null ||
    !('choices' in options) ||
    !Array.isArray(options.choices) ||
    options.choices.length === 0 ||
    options.choices.length > MAX_CHOICE_COUNT
  ) {
    return configurationError(
      `Question-library choices must contain 1-${MAX_CHOICE_COUNT} entries`
    )
  }

  const choices = options.choices.map((choice) => {
    if (
      typeof choice !== 'object' ||
      choice === null ||
      !('ix' in choice) ||
      typeof choice.ix !== 'number' ||
      !Number.isSafeInteger(choice.ix) ||
      !('value' in choice)
    ) {
      return configurationError('Question-library choice is invalid')
    }
    return {
      ix: choice.ix as number,
      text: boundedText(choice.value, 'choice text', MAX_CHOICE_TEXT_LENGTH),
      correct: 'correct' in choice && choice.correct === true,
    }
  })

  const indices = new Set(choices.map((choice) => choice.ix))
  if (indices.size !== choices.length) {
    return configurationError('Question-library choice indexes are duplicated')
  }

  return choices
    .sort((left, right) => left.ix - right.ix)
    .map(({ text, correct }) => ({ text, correct }))
}

export function questionLibraryComparisonEnabled(
  env: RuntimeEnvironment = process.env
): boolean {
  return env.KB_QUESTION_LIBRARY_COMPARISON_ENABLED?.trim() === 'true'
}

export function questionLibraryComparisonMaxElements(
  env: RuntimeEnvironment = process.env
): number {
  const raw = env.KB_QUESTION_LIBRARY_COMPARISON_MAX_ELEMENTS?.trim()
  if (!raw) return MAX_LIBRARY_ELEMENTS
  const value = Number(raw)
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_LIBRARY_ELEMENTS
  ) {
    return configurationError(
      `KB_QUESTION_LIBRARY_COMPARISON_MAX_ELEMENTS must be an integer from 1 to ${MAX_LIBRARY_ELEMENTS}`
    )
  }
  return value
}

export function normalizeQuestionLibraryElement(
  element: LibraryElement
): QuestionLibrarySnapshotQuestion {
  if (
    !Number.isSafeInteger(element.id) ||
    element.id < 1 ||
    !Number.isSafeInteger(element.version) ||
    element.version < 1 ||
    !QUESTION_LIBRARY_ELEMENT_TYPES.includes(element.type)
  ) {
    return configurationError('Question-library element identity is invalid')
  }

  return {
    element_id: element.id,
    version: element.version,
    element_type: element.type as QuestionGenerationItemType,
    name: boundedText(element.name, 'name', MAX_NAME_LENGTH),
    stem: boundedText(element.content, 'stem', MAX_STEM_LENGTH),
    choices: normalizeChoices(element.options),
  }
}

export async function createQuestionLibrarySnapshot(
  ctx: ContextWithUser,
  env: RuntimeEnvironment = process.env
): Promise<Buffer> {
  const limit = questionLibraryComparisonMaxElements(env)
  const elements = await ctx.prisma.element.findMany({
    where: {
      ownerId: ctx.user.sub,
      isArchived: false,
      isDeleted: false,
      type: { in: QUESTION_LIBRARY_ELEMENT_TYPES },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      version: true,
      type: true,
      name: true,
      content: true,
      options: true,
    },
  })
  const selected = elements.slice(0, limit)
  const questions = selected.flatMap((element) => {
    try {
      return [normalizeQuestionLibraryElement(element)]
    } catch (error) {
      if (error instanceof QuestionGenerationServiceError) return []
      throw error
    }
  })
  const incompleteSelection =
    elements.length > limit || questions.length !== selected.length

  const serializedQuestions: string[] = []
  let questionBytes = 0
  for (const question of questions) {
    const serialized = JSON.stringify(canonicalElementGenerationJson(question))
    const candidateCount = serializedQuestions.length + 1
    const candidateQuestionBytes =
      questionBytes +
      Buffer.byteLength(serialized, 'utf8') +
      (serializedQuestions.length > 0 ? 1 : 0)
    const candidateTruncated =
      incompleteSelection || candidateCount < questions.length
    if (
      questionLibrarySnapshotByteLength(
        candidateCount,
        candidateQuestionBytes,
        candidateTruncated
      ) > MAX_BUFFERED_QUESTION_GENERATION_ARTIFACT_BYTES
    ) {
      break
    }
    serializedQuestions.push(serialized)
    questionBytes = candidateQuestionBytes
  }

  const referenceCount = serializedQuestions.length
  const truncated = incompleteSelection || referenceCount < questions.length
  return Buffer.from(
    `{"questions":[${serializedQuestions.join(',')}],"reference_count":${referenceCount},"schema_version":1,"truncated":${truncated}}\n`,
    'utf8'
  )
}

function questionLibrarySnapshotByteLength(
  referenceCount: number,
  questionBytes: number,
  truncated: boolean
): number {
  return (
    Buffer.byteLength(
      `{"questions":[],"reference_count":${referenceCount},"schema_version":1,"truncated":${truncated}}\n`,
      'utf8'
    ) + questionBytes
  )
}
