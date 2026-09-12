import type { KlickerChatContext } from '@klicker-uzh/types'

const CONTENT_PREVIEW_MAX_LENGTH = 500

type ChatActivity = NonNullable<KlickerChatContext['activity']>
type ChatQuestion = NonNullable<KlickerChatContext['question']>

export type ChatStackElement = {
  id?: number | null
  elementType?: string | null
  elementData?: {
    type?: string | null
    content?: string | null
  } | null
}

export type ChatStack = {
  id: string | number
  elements?: readonly ChatStackElement[] | null
}

export type PracticeQuizChatActivity = {
  id: string
  displayName?: string | null
  stacks?: readonly ChatStack[] | null
}

export type MicroLearningChatActivity = PracticeQuizChatActivity

export function buildCourseChatContext({
  courseId,
  locale,
}: {
  courseId: string
  locale: string
}): KlickerChatContext {
  return {
    version: 1,
    source: 'pwa',
    surface: 'course-home',
    locale,
    courseId,
  }
}

export function buildActivityChatContext({
  courseId,
  locale,
  surface,
  activity,
}: {
  courseId: string
  locale: string
  surface: KlickerChatContext['surface']
  activity?: ChatActivity | null
}): KlickerChatContext {
  return {
    version: 1,
    source: 'pwa',
    surface,
    locale,
    courseId,
    ...(activity ? { activity } : {}),
  }
}

export function buildStackQuestionChatContext({
  baseContext,
  currentStep,
  stack,
  totalSteps,
}: {
  baseContext: KlickerChatContext
  currentStep: number
  stack?: ChatStack | null
  totalSteps: number
}): KlickerChatContext {
  const question = buildQuestionContext({ currentStep, stack, totalSteps })

  return {
    ...baseContext,
    ...(question ? { question } : {}),
  }
}

export function buildPracticeQuizChatContext({
  courseId,
  currentIx,
  locale,
  practiceQuiz,
  totalSteps,
}: {
  courseId: string
  currentIx: number
  locale: string
  practiceQuiz: PracticeQuizChatActivity | null
  totalSteps: number
}): KlickerChatContext {
  const stack = currentIx >= 0 ? practiceQuiz?.stacks?.[currentIx] : undefined
  const baseContext = buildActivityChatContext({
    courseId,
    locale,
    surface: 'practice-quiz',
    activity: practiceQuiz
      ? buildActivity({
          type: 'practiceQuiz',
          id: practiceQuiz.id,
          displayName: practiceQuiz.displayName ?? undefined,
        })
      : undefined,
  })

  return buildStackQuestionChatContext({
    baseContext,
    currentStep: currentIx + 1,
    stack,
    totalSteps,
  })
}

export function buildMicroLearningChatContext({
  courseId,
  currentIx,
  locale,
  microLearning,
  totalSteps,
}: {
  courseId: string
  currentIx?: number
  locale: string
  microLearning: MicroLearningChatActivity | null
  totalSteps: number
}): KlickerChatContext {
  const stack =
    currentIx != null && currentIx >= 0
      ? microLearning?.stacks?.[currentIx]
      : undefined
  const baseContext = buildActivityChatContext({
    courseId,
    locale,
    surface: 'microlearning',
    activity: microLearning
      ? buildActivity({
          type: 'microLearning',
          id: microLearning.id,
          displayName: microLearning.displayName ?? undefined,
        })
      : undefined,
  })

  return buildStackQuestionChatContext({
    baseContext,
    currentStep: currentIx != null ? currentIx + 1 : 0,
    stack,
    totalSteps,
  })
}

export function toContentPreview(
  value: string | null | undefined
): string | undefined {
  if (!value) return undefined

  const preview = stripHtmlTags(stripMarkdownImagesAndLinks(value))
    .replace(/\s+/g, ' ')
    .trim()

  if (!preview) return undefined
  return preview.length > CONTENT_PREVIEW_MAX_LENGTH
    ? `${preview.slice(0, CONTENT_PREVIEW_MAX_LENGTH - 3)}...`
    : preview
}

function buildActivity({ displayName, id, type }: ChatActivity): ChatActivity {
  return {
    type,
    id,
    ...(displayName != null ? { displayName } : {}),
  }
}

function buildQuestionContext({
  currentStep,
  stack,
  totalSteps,
}: {
  currentStep: number
  stack?: ChatStack | null
  totalSteps: number
}): ChatQuestion | undefined {
  if (!stack) return undefined

  const firstElement = stack.elements?.[0]
  const contentPreview = toContentPreview(firstElement?.elementData?.content)
  const type =
    firstElement?.elementData?.type ?? firstElement?.elementType ?? undefined

  return {
    stackId: String(stack.id),
    ...(typeof firstElement?.id === 'number'
      ? { elementInstanceId: firstElement.id }
      : {}),
    ...(type != null ? { type } : {}),
    ...(contentPreview ? { contentPreview } : {}),
    currentStep,
    totalSteps,
  }
}

function stripMarkdownImagesAndLinks(value: string): string {
  let output = ''
  let index = 0

  while (index < value.length) {
    const char = value.charAt(index)

    if (char === '!' && value.charAt(index + 1) === '[') {
      const bounds = getMarkdownLinkBounds(value, index + 2)

      if (bounds) {
        index = bounds.urlEnd + 1
        continue
      }
    }

    if (char === '[') {
      const bounds = getMarkdownLinkBounds(value, index + 1)

      if (bounds) {
        output += value.slice(index + 1, bounds.labelEnd)
        index = bounds.urlEnd + 1
        continue
      }
    }

    output += char
    index += 1
  }

  return output
}

function getMarkdownLinkBounds(
  value: string,
  labelStart: number
): { labelEnd: number; urlEnd: number } | null {
  const labelEnd = value.indexOf(']', labelStart)

  if (labelEnd < 0 || value.charAt(labelEnd + 1) !== '(') {
    return null
  }

  const urlEnd = value.indexOf(')', labelEnd + 2)
  return urlEnd >= 0 ? { labelEnd, urlEnd } : null
}

function stripHtmlTags(value: string): string {
  let output = ''
  let insideTag = false

  for (const char of value) {
    if (char === '<') {
      insideTag = true
      output += ' '
      continue
    }

    if (insideTag) {
      if (char === '>') {
        insideTag = false
      }
      continue
    }

    output += char
  }

  return output
}
