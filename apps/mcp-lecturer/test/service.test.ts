import { describe, expect, it, vi } from 'vitest'
import { LecturerMcpAuthorizationError } from '../src/authorization.js'
import { createLecturerReadService } from '../src/service.js'

const session = {
  bearerToken: 'test-token',
  scopes: ['manage:read' as const],
  userId: 'lecturer-a',
}

const COURSE_ID = '11111111-1111-4111-8111-111111111111'

const longContent = `<b>${'statistics '.repeat(90)}</b>`

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    course: {
      findFirst: vi.fn(),
    },
    derivedPermission: {
      findMany: vi.fn(),
    },
    element: {
      findFirst: vi.fn(),
    },
    ...overrides,
  }
}

describe('lecturer MCP read service', () => {
  it('lists only lecturer-accessible courses with capped output and no PIN data', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.derivedPermission.findMany).mockResolvedValue([
      {
        course: {
          color: '#abcdef',
          description: 'Archived should not be included by default query args',
          displayName: 'Statistics 101',
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          id: COURSE_ID,
          isArchived: false,
          language: 'en',
          name: 'stats',
          startDate: new Date('2026-02-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-01T12:00:00.000Z'),
        },
        derived: false,
        permissionLevel: 'OWNER',
        userId: 'lecturer-a',
      },
    ])

    const result = await createLecturerReadService(prisma).listCourses(
      {
        limit: 5,
        query: 'stats',
      },
      session
    )

    expect(prisma.derivedPermission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          course: expect.objectContaining({
            isArchived: false,
          }),
          courseId: { not: null },
          userId: 'lecturer-a',
        }),
      })
    )
    expect(result.courses).toEqual([
      expect.objectContaining({
        id: COURSE_ID,
        name: 'Statistics 101',
        permissionLevel: 'OWNER',
      }),
    ])
    expect(JSON.stringify(result)).not.toContain('pinCode')
  })

  it('applies a case-insensitive substring OR filter for a genuine course query', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.derivedPermission.findMany).mockResolvedValue([])

    await createLecturerReadService(prisma).listCourses(
      { query: 'stats' },
      session
    )

    const where = vi.mocked(prisma.derivedPermission.findMany).mock.calls[0]![0]
      .where
    expect(where.course.OR).toEqual([
      { displayName: { contains: 'stats', mode: 'insensitive' } },
      { name: { contains: 'stats', mode: 'insensitive' } },
    ])
  })

  it('treats a wildcard-only course query as no filter', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.derivedPermission.findMany).mockResolvedValue([])

    await createLecturerReadService(prisma).listCourses(
      { query: '.*' },
      session
    )

    const where = vi.mocked(prisma.derivedPermission.findMany).mock.calls[0]![0]
      .where
    expect(where.course).not.toHaveProperty('OR')
  })

  it('gets a course only with a matching derived READ permission', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.course.findFirst).mockResolvedValue({
      _count: {
        groupActivities: 1,
        liveQuizzes: 2,
        microLearnings: 3,
        practiceQuizzes: 4,
      },
      color: '#123456',
      description: 'Course details',
      displayName: 'Accessible Course',
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      id: COURSE_ID,
      isArchived: false,
      language: 'en',
      name: 'course-access',
      permissions: [
        {
          derived: true,
          permissionLevel: 'READ',
          userId: 'lecturer-a',
        },
      ],
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T12:00:00.000Z'),
    })

    const result = await createLecturerReadService(prisma).getCourse(
      { courseId: COURSE_ID },
      session
    )
    const select = vi.mocked(prisma.course.findFirst).mock.calls[0]![0].select

    expect(result.course).toMatchObject({
      activityCounts: {
        groupActivities: 1,
        liveQuizzes: 2,
        microLearnings: 3,
        practiceQuizzes: 4,
      },
      id: COURSE_ID,
      permissionLevel: 'READ',
    })
    expect(select).not.toHaveProperty('pinCode')
  })

  it('denies guessed course ids without a matching derived permission', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.course.findFirst).mockResolvedValue({
      id: COURSE_ID,
      permissions: [],
    })

    await expect(
      createLecturerReadService(prisma).getCourse(
        { courseId: COURSE_ID },
        session
      )
    ).rejects.toBeInstanceOf(LecturerMcpAuthorizationError)
  })

  it('searches elements through derived permissions and returns capped plain snippets', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.derivedPermission.findMany).mockResolvedValue([
      {
        derived: false,
        element: {
          content: longContent,
          id: 12,
          name: 'Standard deviation',
          status: 'READY',
          tags: [{ id: 1, name: 'statistics' }],
          type: 'SC',
          updatedAt: new Date('2026-03-01T12:00:00.000Z'),
        },
        permissionLevel: 'WRITE',
        userId: 'lecturer-a',
      },
    ])

    const result = await createLecturerReadService(prisma).searchElements(
      {
        limit: 1,
        query: 'deviation',
        status: 'READY',
        type: 'SC',
      },
      session
    )

    expect(prisma.derivedPermission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        where: expect.objectContaining({
          element: expect.objectContaining({
            isArchived: false,
            isDeleted: false,
            status: 'READY',
            type: 'SC',
          }),
          elementId: { not: null },
          userId: 'lecturer-a',
        }),
      })
    )
    expect(result.hasMore).toBe(false)
    expect(result.elements[0]).toMatchObject({
      id: 12,
      name: 'Standard deviation',
      permissionLevel: 'WRITE',
    })
    expect(result.elements[0]!.snippet.length).toBeLessThanOrEqual(500)
    expect(result.elements[0]!.snippet).not.toContain('<b>')
  })

  it('treats a wildcard-only element query as no filter', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.derivedPermission.findMany).mockResolvedValue([])

    await createLecturerReadService(prisma).searchElements(
      { query: '*' },
      session
    )

    const where = vi.mocked(prisma.derivedPermission.findMany).mock.calls[0]![0]
      .where
    expect(where.element).not.toHaveProperty('OR')
  })

  it('gets an element only with a matching derived READ permission and caps detailed fields', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.element.findFirst).mockResolvedValue({
      content: longContent.repeat(20),
      explanation: '<i>private explanation</i>',
      id: 12,
      name: 'Standard deviation',
      options: { choices: Array.from({ length: 100 }, (_, ix) => ({ ix })) },
      permissions: [
        {
          derived: false,
          permissionLevel: 'OWNER',
          userId: 'lecturer-a',
        },
      ],
      status: 'READY',
      tags: [{ id: 1, name: 'statistics' }],
      type: 'SC',
      updatedAt: new Date('2026-03-01T12:00:00.000Z'),
    })

    const result = await createLecturerReadService(prisma).getElement(
      { elementId: 12 },
      session
    )

    expect(prisma.element.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          content: true,
          options: true,
        }),
        where: expect.objectContaining({
          isArchived: false,
          isDeleted: false,
        }),
      })
    )
    expect(result.element).toMatchObject({
      id: 12,
      name: 'Standard deviation',
      permissionLevel: 'OWNER',
    })
    expect(result.element.content.length).toBeLessThanOrEqual(4000)
    expect(result.element.content).not.toContain('<b>')
    expect(JSON.stringify(result.element.options).length).toBeLessThanOrEqual(
      4300
    )
  })

  it('creates a non-persisted question draft and checks optional course context', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.course.findFirst).mockResolvedValue({
      color: '#123456',
      description: 'Course details',
      displayName: 'Accessible Course',
      endDate: null,
      id: COURSE_ID,
      isArchived: false,
      language: 'en',
      name: 'course-access',
      permissions: [
        {
          derived: true,
          permissionLevel: 'READ',
          userId: 'lecturer-a',
        },
      ],
      startDate: null,
      updatedAt: new Date('2026-03-01T12:00:00.000Z'),
    })

    const result = await createLecturerReadService(prisma).createQuestionDraft(
      {
        courseId: COURSE_ID,
        difficulty: 'intermediate',
        learningObjective: 'Interpret a standard deviation.',
        topic: 'standard deviation',
        type: 'SC',
      },
      { ...session, scopes: ['manage:read', 'manage:draft'] }
    )

    expect(prisma.course.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: COURSE_ID,
          permissions: { some: { userId: 'lecturer-a' } },
        }),
      })
    )
    expect(result).toMatchObject({
      kind: 'question.draft',
      requiresConfirmation: false,
      payload: {
        courseId: COURSE_ID,
        name: 'standard deviation',
        status: 'DRAFT',
        type: 'SC',
      },
    })
    expect(prisma).not.toHaveProperty('element.create')
  })

  it('denies question drafts for inaccessible course context', async () => {
    const prisma = makePrisma()
    vi.mocked(prisma.course.findFirst).mockResolvedValue(null)

    await expect(
      createLecturerReadService(prisma).createQuestionDraft(
        {
          courseId: COURSE_ID,
          topic: 'standard deviation',
        },
        { ...session, scopes: ['manage:read', 'manage:draft'] }
      )
    ).rejects.toBeInstanceOf(LecturerMcpAuthorizationError)
  })

  it('creates non-persisted choices and feedback drafts', () => {
    const prisma = makePrisma()
    const service = createLecturerReadService(prisma)

    const choices = service.createChoicesDraft(
      {
        correctAnswer: 'Variance square root',
        distractorCount: 2,
        question: 'What is standard deviation?',
      },
      { ...session, scopes: ['manage:read', 'manage:draft'] }
    )
    const feedback = service.createFeedbackDraft(
      {
        choices: choices.payload.choices.map((choice) => choice.value),
        question: 'What is standard deviation?',
      },
      { ...session, scopes: ['manage:read', 'manage:draft'] }
    )

    expect(choices).toMatchObject({
      kind: 'choices.draft',
      requiresConfirmation: false,
      payload: {
        choices: [
          { correct: true, value: 'Variance square root' },
          { correct: false, value: 'Plausible distractor 1' },
          { correct: false, value: 'Plausible distractor 2' },
        ],
      },
    })
    expect(feedback).toMatchObject({
      kind: 'feedback.draft',
      requiresConfirmation: false,
      payload: {
        question: 'What is standard deviation?',
      },
    })
    expect(feedback.payload.feedback).toEqual([
      {
        choice: 'Variance square root',
        feedback: 'Use this feedback to reinforce why this answer is correct.',
      },
      {
        choice: 'Plausible distractor 1',
        feedback:
          'Use this feedback to address the misconception behind this answer.',
      },
      {
        choice: 'Plausible distractor 2',
        feedback:
          'Use this feedback to address the misconception behind this answer.',
      },
    ])
    expect(prisma.course.findFirst).not.toHaveBeenCalled()
    expect(prisma.derivedPermission.findMany).not.toHaveBeenCalled()
    expect(prisma.element.findFirst).not.toHaveBeenCalled()
  })

  it('creates a signed-confirmation-ready draft element proposal without persisting it', () => {
    const prisma = makePrisma()

    const result = createLecturerReadService(prisma).createElementDraftProposal(
      {
        choices: [
          {
            correct: true,
            feedback: 'Correct: standard deviation measures spread.',
            value: 'Variation or dispersion in the data',
          },
          { correct: false, value: 'The average value' },
          { correct: false, value: 'The most frequent value' },
        ],
        content: 'What does standard deviation measure?',
        explanation: 'Standard deviation summarizes dispersion.',
        name: 'Standard deviation interpretation',
        tags: ['statistics'],
        type: 'MC',
      },
      { ...session, scopes: ['manage:read', 'manage:draft'] }
    )

    expect(result).toMatchObject({
      kind: 'element.create.proposal',
      requiresConfirmation: true,
      summary: 'Create DRAFT MC question "Standard deviation interpretation"',
      payload: {
        basePoints: true,
        content: 'What does standard deviation measure?',
        explanation: 'Standard deviation summarizes dispersion.',
        name: 'Standard deviation interpretation',
        pointsMultiplier: 1,
        status: 'DRAFT',
        tags: ['statistics'],
        type: 'MC',
      },
    })
    expect(result.payload.options).toMatchObject({
      displayMode: 'LIST',
      hasAnswerFeedbacks: true,
      hasSampleSolution: true,
    })
    expect(prisma.course.findFirst).not.toHaveBeenCalled()
    expect(prisma.derivedPermission.findMany).not.toHaveBeenCalled()
    expect(prisma.element.findFirst).not.toHaveBeenCalled()
  })
})
