import { z } from 'zod'

export const MANAGE_ASSISTANT_TOOL_NAMES = [
  'klicker_manage_course_list',
  'klicker_manage_element_search',
  'klicker_manage_element_get',
  'klicker_manage_question_draft',
  'klicker_manage_choices_draft',
  'klicker_manage_feedback_draft',
] as const

export type ManageAssistantToolName =
  (typeof MANAGE_ASSISTANT_TOOL_NAMES)[number]

type ManagePrisma = {
  course: {
    findMany: (args: unknown) => Promise<CourseRow[]>
  }
  element: {
    findMany: (args: unknown) => Promise<ElementRow[]>
    findFirst: (args: unknown) => Promise<ElementDetailRow | null>
  }
}

type CourseRow = {
  id: string
  displayName: string
  name: string
  language: string
  updatedAt: Date
}

type ElementRow = {
  id: number
  name: string
  type: string
  status: string
  updatedAt: Date
}

type ElementDetailRow = ElementRow & {
  content: string
  explanation: string | null
  options: unknown
  tags?: { id: number; name: string }[]
}

export type ManageToolContext = {
  prisma: ManagePrisma
  userId: string
}

const limitSchema = z.number().int().min(1).max(50).default(20)
const elementTypeSchema = z.enum([
  'SC',
  'MC',
  'KPRIM',
  'FREE_TEXT',
  'NUMERICAL',
  'CONTENT',
  'FLASHCARD',
  'SELECTION',
  'CASE_STUDY',
])
const elementStatusSchema = z.enum(['DRAFT', 'REVIEW', 'READY'])

export const courseListInputSchema = z.object({
  limit: limitSchema,
})

export const elementSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(120).optional(),
  type: elementTypeSchema.optional(),
  status: elementStatusSchema.optional(),
  limit: limitSchema,
})

export const elementGetInputSchema = z.object({
  id: z.number().int().positive(),
})

export const questionDraftInputSchema = z.object({
  topic: z.string().trim().min(1).max(160),
  type: z.enum(['SC', 'MC', 'FREE_TEXT']).default('SC'),
  learningObjective: z.string().trim().min(1).max(240).optional(),
  difficulty: z.enum(['introductory', 'intermediate', 'advanced']).optional(),
})

export const choicesDraftInputSchema = z.object({
  question: z.string().trim().min(1).max(500),
  correctAnswer: z.string().trim().min(1).max(240).optional(),
  distractorCount: z.number().int().min(1).max(5).default(3),
})

export const feedbackDraftInputSchema = z.object({
  question: z.string().trim().min(1).max(500),
  choices: z.array(z.string().trim().min(1).max(240)).min(1).max(8),
})

export async function listManageCourses(
  context: ManageToolContext,
  input: unknown
) {
  const args = courseListInputSchema.parse(input ?? {})
  const courses = await context.prisma.course.findMany({
    where: {
      ownerId: context.userId,
      isArchived: false,
    },
    orderBy: { updatedAt: 'desc' },
    take: args.limit,
    select: {
      id: true,
      displayName: true,
      name: true,
      language: true,
      updatedAt: true,
    },
  })

  return {
    courses: courses.map((course) => ({
      id: course.id,
      name: course.displayName || course.name,
      language: course.language,
      updatedAt: course.updatedAt.toISOString(),
    })),
  }
}

export async function searchManageElements(
  context: ManageToolContext,
  input: unknown
) {
  const args = elementSearchInputSchema.parse(input ?? {})
  const elements = await context.prisma.element.findMany({
    where: {
      ownerId: context.userId,
      isDeleted: false,
      isArchived: false,
      ...(args.type ? { type: args.type } : {}),
      ...(args.status ? { status: args.status } : {}),
      ...(args.query
        ? {
            OR: [
              { name: { contains: args.query, mode: 'insensitive' } },
              { content: { contains: args.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: args.limit,
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      updatedAt: true,
    },
  })

  return {
    elements: elements.map((element) => ({
      ...element,
      updatedAt: element.updatedAt.toISOString(),
    })),
  }
}

export async function getManageElement(
  context: ManageToolContext,
  input: unknown
) {
  const args = elementGetInputSchema.parse(input)
  const element = await context.prisma.element.findFirst({
    where: {
      id: args.id,
      ownerId: context.userId,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      content: true,
      explanation: true,
      options: true,
      updatedAt: true,
      tags: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!element) {
    return { element: null }
  }

  return {
    element: {
      ...element,
      updatedAt: element.updatedAt.toISOString(),
    },
  }
}

export function createQuestionDraft(input: unknown) {
  const args = questionDraftInputSchema.parse(input)
  const objective = args.learningObjective
    ? `\n\nLearning objective: ${args.learningObjective}`
    : ''
  const difficulty = args.difficulty ? `\nDifficulty: ${args.difficulty}` : ''

  return {
    kind: 'question.draft' as const,
    requiresConfirmation: false,
    payload: {
      name: args.topic,
      type: args.type,
      status: 'DRAFT' as const,
      content: `Draft a ${formatQuestionType(args.type)} question about ${args.topic}.${objective}${difficulty}`,
      options: getDefaultQuestionOptions(args.type),
    },
  }
}

export function createChoicesDraft(input: unknown) {
  const args = choicesDraftInputSchema.parse(input)
  const choices = [
    {
      value:
        args.correctAnswer ??
        'A concise answer that directly addresses the question.',
      correct: true,
    },
    ...Array.from({ length: args.distractorCount }, (_, index) => ({
      value: `Plausible distractor ${index + 1}`,
      correct: false,
    })),
  ]

  return {
    kind: 'choices.draft' as const,
    requiresConfirmation: false,
    payload: {
      question: args.question,
      choices,
    },
  }
}

export function createFeedbackDraft(input: unknown) {
  const args = feedbackDraftInputSchema.parse(input)

  return {
    kind: 'feedback.draft' as const,
    requiresConfirmation: false,
    payload: {
      question: args.question,
      feedback: args.choices.map((choice, index) => ({
        choice,
        feedback:
          index === 0
            ? 'Use this feedback to reinforce why this answer is correct.'
            : 'Use this feedback to address the misconception behind this answer.',
      })),
    },
  }
}

function getDefaultQuestionOptions(type: 'SC' | 'MC' | 'FREE_TEXT') {
  if (type === 'FREE_TEXT') {
    return {
      hasSampleSolution: false,
      restrictions: {},
    }
  }

  return {
    displayMode: 'LIST',
    hasSampleSolution: false,
    hasAnswerFeedbacks: false,
    choices: [],
  }
}

function formatQuestionType(type: 'SC' | 'MC' | 'FREE_TEXT') {
  if (type === 'SC') return 'single-choice'
  if (type === 'MC') return 'multiple-choice'
  return 'free-text'
}
