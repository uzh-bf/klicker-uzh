import { describe, expect, test } from 'vitest'
import {
  createChoicesDraft,
  createFeedbackDraft,
  createQuestionDraft,
  listManageCourses,
  MANAGE_ASSISTANT_TOOL_NAMES,
  searchManageElements,
  type ManageToolContext,
} from '../src/services/manageAssistantTools'

describe('Manage assistant tools', () => {
  test('exposes the first read and draft tool names', () => {
    expect(MANAGE_ASSISTANT_TOOL_NAMES).toEqual([
      'klicker_manage_course_list',
      'klicker_manage_element_search',
      'klicker_manage_element_get',
      'klicker_manage_question_draft',
      'klicker_manage_choices_draft',
      'klicker_manage_feedback_draft',
    ])
  })

  test('creates a non-persisted question draft envelope', () => {
    expect(
      createQuestionDraft({
        topic: 'Opportunity cost',
        type: 'SC',
        learningObjective: 'Explain trade-offs',
      })
    ).toMatchObject({
      kind: 'question.draft',
      requiresConfirmation: false,
      payload: {
        type: 'SC',
        status: 'DRAFT',
        name: 'Opportunity cost',
      },
    })
  })

  test('creates choices and feedback drafts without write side effects', () => {
    expect(
      createChoicesDraft({
        question: 'Which statement best describes opportunity cost?',
        correctAnswer: 'The value of the next-best alternative.',
        distractorCount: 2,
      }).payload.choices
    ).toHaveLength(3)

    expect(
      createFeedbackDraft({
        question: 'Which statement best describes opportunity cost?',
        choices: [
          'The value of the next-best alternative.',
          'The amount paid at checkout.',
        ],
      }).payload.feedback
    ).toHaveLength(2)
  })

  test('scopes read handlers to the authenticated lecturer', async () => {
    const calls: unknown[] = []
    const context: ManageToolContext = {
      userId: 'user-1',
      prisma: {
        course: {
          findMany: async (args) => {
            calls.push(args)
            return [
              {
                id: 'course-1',
                displayName: 'Course One',
                name: 'course-one',
                language: 'en',
                updatedAt: new Date('2026-05-30T08:00:00.000Z'),
              },
            ]
          },
        },
        element: {
          findMany: async (args) => {
            calls.push(args)
            return []
          },
          findFirst: async () => null,
        },
      },
    }

    await listManageCourses(context, undefined)
    await searchManageElements(context, { query: 'cost' })

    expect(calls[0]).toMatchObject({ where: { ownerId: 'user-1' } })
    expect(calls[1]).toMatchObject({ where: { ownerId: 'user-1' } })
  })
})
