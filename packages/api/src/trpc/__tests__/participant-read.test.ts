import {
  AwardType,
  ElementType,
  Locale,
  PublicationStatus,
  TimelineEntryType,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  prisma,
  role = UserRole.PARTICIPANT,
  scope,
  sub = 'participant-1',
}: {
  prisma?: TRPCContext['prisma']
  role?: UserRole
  scope?: UserLoginScope
  sub?: string
} = {}): TRPCContext {
  return {
    prisma,
    user: {
      sub,
      role,
      scope,
    },
  }
}

const levelData = {
  id: 1,
  index: 1,
  name: 'Starter',
  avatar: null,
  requiredXp: 0,
  nextLevel: {
    id: 2,
    index: 2,
    name: 'Next',
    avatar: 'next.svg',
    requiredXp: 9000,
  },
}

describe('participant read routers', () => {
  test('returns null self without an authenticated user', async () => {
    const caller = appRouter.createCaller({})

    await expect(caller.participant.self()).resolves.toEqual({ self: null })
  })

  test('returns participant self with course participation flags', async () => {
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'course-1' }),
      },
      participant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'participant-1',
          email: 'student@example.com',
          username: 'student1',
          locale: Locale.en,
          avatar: 'avatar.svg',
          avatarSettings: {
            skinTone: 'tone',
            eyes: 'eyes',
            mouth: 'mouth',
            hair: 'hair',
            facialHair: 'facialHair',
            accessory: 'accessory',
            hairColor: 'hairColor',
            clothing: 'clothing',
            clothingColor: 'clothingColor',
          },
          isActive: true,
          isProfilePublic: false,
          xp: 0,
          participations: [{ isActive: true }],
          accounts: [{ ssoEmail: 'student@uzh.ch' }],
        }),
      },
      level: {
        findUnique: vi.fn().mockResolvedValue(levelData),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.self({ liveQuizId: 'quiz-1' })
    ).resolves.toEqual({
      self: {
        id: 'participant-1',
        role: UserRole.PARTICIPANT,
        scopeQuizId: null,
        isCourseParticipant: true,
        isCourseParticipationActive: true,
        email: 'student@example.com',
        institutionalEmail: 'student@uzh.ch',
        username: 'student1',
        locale: Locale.en,
        avatar: 'avatar.svg',
        avatarSettings: {
          skinTone: 'tone',
          eyes: 'eyes',
          mouth: 'mouth',
          hair: 'hair',
          facialHair: 'facialHair',
          accessory: 'accessory',
          hairColor: 'hairColor',
          clothing: 'clothing',
          clothingColor: 'clothingColor',
        },
        isActive: true,
        isProfilePublic: false,
        xp: 0,
        level: 1,
        levelData,
      },
    })
  })

  test('returns temporary participant self only for a scoped live quiz', async () => {
    const prisma = {
      temporaryLeaderboardEntry: {
        findUnique: vi.fn().mockResolvedValue({
          avatar: 'temporary.svg',
          quizId: 'quiz-1',
          username: 'Guest 1',
        }),
      },
      level: {
        findUnique: vi.fn().mockResolvedValue(levelData),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        prisma,
        role: UserRole.TEMPORARY_PARTICIPANT,
        sub: 'temporary-1',
      })
    )

    await expect(
      caller.participant.self({ liveQuizId: 'quiz-1' })
    ).resolves.toEqual({
      self: {
        id: 'temporary-1',
        role: UserRole.TEMPORARY_PARTICIPANT,
        scopeQuizId: 'quiz-1',
        isCourseParticipant: false,
        isCourseParticipationActive: false,
        email: null,
        institutionalEmail: null,
        username: 'Guest 1',
        locale: null,
        avatar: 'temporary.svg',
        avatarSettings: null,
        isActive: true,
        isProfilePublic: true,
        xp: null,
        level: 1,
        levelData,
      },
    })
  })

  test('returns participant course list', async () => {
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue({
          participations: [
            {
              course: {
                id: 'course-1',
                isArchived: false,
                displayName: 'Course One',
                description: 'Description',
              },
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.participant.courses()).resolves.toEqual({
      participantCourses: [
        {
          id: 'course-1',
          isArchived: false,
          displayName: 'Course One',
          description: 'Description',
        },
      ],
    })
  })

  test('returns participations for the participant home page', async () => {
    const startDate = new Date('2025-01-01T00:00:00.000Z')
    const endDate = new Date('2026-01-01T00:00:00.000Z')
    const scheduledStartAt = new Date('2025-06-01T00:00:00.000Z')
    const scheduledEndAt = new Date('2025-06-15T00:00:00.000Z')
    const findUnique = vi.fn().mockResolvedValue({
      participations: [
        {
          id: 1,
          completedMicroLearnings: ['micro-completed'],
          subscriptions: [{ id: 3, endpoint: 'endpoint-1' }],
          course: {
            id: 'course-1',
            displayName: 'Course One',
            startDate,
            endDate,
            description: 'Description',
            isGamificationEnabled: true,
            microLearnings: [
              {
                id: 'micro-active',
                displayName: 'Active Microlearning',
                scheduledStartAt,
                scheduledEndAt,
              },
            ],
            liveQuizzes: [
              {
                id: 'live-quiz-1',
                displayName: 'Live Quiz One',
              },
            ],
          },
        },
      ],
    })
    const prisma = {
      participant: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.participations({
        endpoint: 'endpoint-1',
        assessmentOnly: true,
      })
    ).resolves.toEqual({
      participations: [
        {
          id: 1,
          completedMicroLearnings: ['micro-completed'],
          subscriptions: [{ id: 3, endpoint: 'endpoint-1' }],
          course: {
            id: 'course-1',
            displayName: 'Course One',
            startDate,
            endDate,
            description: 'Description',
            isGamificationEnabled: true,
            microLearnings: [
              {
                id: 'micro-active',
                displayName: 'Active Microlearning',
                scheduledStartAt,
                scheduledEndAt,
              },
            ],
            liveQuizzes: [
              {
                id: 'live-quiz-1',
                displayName: 'Live Quiz One',
              },
            ],
          },
        },
      ],
    })

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          participations: expect.objectContaining({
            where: { course: { isAssessmentEnabled: true } },
            orderBy: { course: { displayName: 'asc' } },
          }),
        }),
      })
    )
    expect(
      findUnique.mock.calls[0]?.[0].select.participations.select.subscriptions
        .where
    ).toEqual({ endpoint: 'endpoint-1' })
  })

  test('returns accumulated course student timelines ordered by course end date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T12:00:00.000Z'))

    try {
      const gamifiedStart = new Date('2026-01-01T00:00:00.000Z')
      const gamifiedEnd = new Date('2026-12-31T00:00:00.000Z')
      const nonGamifiedStart = new Date('2025-01-01T00:00:00.000Z')
      const nonGamifiedEnd = new Date('2025-12-31T00:00:00.000Z')
      const timelineFindUnique = vi.fn().mockResolvedValue({
        participations: [
          {
            course: {
              id: 'course-old',
              displayName: 'Old Course',
              isGamificationEnabled: false,
              startDate: nonGamifiedStart,
              endDate: nonGamifiedEnd,
            },
            timelineEntries: [
              {
                timestamp: new Date('2025-02-02T00:00:00.000Z'),
                collectedPoints: 7,
                collectedXp: 5,
              },
              {
                timestamp: new Date('2025-02-01T00:00:00.000Z'),
                collectedPoints: 3,
                collectedXp: 10,
              },
            ],
          },
          {
            course: {
              id: 'course-new',
              displayName: 'New Course',
              isGamificationEnabled: true,
              startDate: gamifiedStart,
              endDate: gamifiedEnd,
            },
            timelineEntries: [
              {
                timestamp: new Date('2026-03-02T00:00:00.000Z'),
                collectedPoints: 3,
                collectedXp: 4,
              },
              {
                timestamp: new Date('2026-03-01T00:00:00.000Z'),
                collectedPoints: 2,
                collectedXp: 10,
              },
            ],
          },
        ],
      })
      const prisma = {
        participant: {
          findUnique: timelineFindUnique,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(createContext({ prisma }))

      await expect(
        caller.participant.courseStudentTimelines()
      ).resolves.toEqual({
        courseStudentTimelines: [
          {
            courseId: 'course-new',
            courseName: 'New Course',
            courseGamified: true,
            courseStart: gamifiedStart,
            courseEnd: gamifiedEnd,
            timelineEntries: [
              {
                timestamp: new Date('2026-03-01T00:00:00.000Z'),
                collectedPoints: 2,
                collectedXp: 10,
                totalPoints: 2,
                totalXp: 10,
              },
              {
                timestamp: new Date('2026-03-02T00:00:00.000Z'),
                collectedPoints: 3,
                collectedXp: 4,
                totalPoints: 5,
                totalXp: 14,
              },
            ],
          },
          {
            courseId: 'course-old',
            courseName: 'Old Course',
            courseGamified: false,
            courseStart: nonGamifiedStart,
            courseEnd: nonGamifiedEnd,
            timelineEntries: [
              {
                timestamp: new Date('2025-02-01T00:00:00.000Z'),
                collectedPoints: null,
                collectedXp: 10,
                totalPoints: null,
                totalXp: 10,
              },
              {
                timestamp: new Date('2025-02-02T00:00:00.000Z'),
                collectedPoints: null,
                collectedXp: 5,
                totalPoints: null,
                totalXp: 15,
              },
            ],
          },
        ],
      })

      expect(timelineFindUnique).toHaveBeenCalledWith({
        where: { id: 'participant-1' },
        select: {
          participations: {
            select: {
              timelineEntries: {
                where: {
                  OR: [
                    {
                      type: TimelineEntryType.WEEKLY,
                      timestamp: {
                        lt: new Date('2026-05-20T12:00:00.000Z'),
                      },
                    },
                    {
                      type: TimelineEntryType.DAILY,
                      timestamp: {
                        gte: new Date('2026-05-20T12:00:00.000Z'),
                      },
                    },
                  ],
                },
                select: {
                  timestamp: true,
                  collectedPoints: true,
                  collectedXp: true,
                },
              },
              course: {
                select: {
                  id: true,
                  displayName: true,
                  isGamificationEnabled: true,
                  startDate: true,
                  endDate: true,
                },
              },
            },
          },
        },
      })
    } finally {
      vi.useRealTimers()
    }
  })

  test.each([
    { label: 'missing participant', participant: null },
    { label: 'no participations', participant: { participations: [] } },
  ])(
    'returns no course student timelines for $label',
    async ({ participant }) => {
      const prisma = {
        participant: {
          findUnique: vi.fn().mockResolvedValue(participant),
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(createContext({ prisma }))

      await expect(
        caller.participant.courseStudentTimelines()
      ).resolves.toEqual({
        courseStudentTimelines: [],
      })
    }
  )

  test('returns student assessment results with deduplicated corrections', async () => {
    const finishedAt = new Date('2026-01-15T10:00:00.000Z')
    const correctionDate = new Date('2026-01-16T10:00:00.000Z')
    const courseFindUnique = vi.fn().mockResolvedValue({
      liveQuizzes: [
        {
          id: 'quiz-1',
          displayName: 'Assessment Quiz',
          finishedAt,
          pointsMultiplier: 2,
          defaultPoints: 2,
          defaultCorrectPoints: 3,
          maxBonusPoints: 1,
          blocks: [
            {
              elements: [
                {
                  elementType: ElementType.FREE_TEXT,
                  elementData: { options: { hasSampleSolution: true } },
                  options: { basePoints: true, pointsMultiplier: 2 },
                  liveQuizResponses: [
                    {
                      basePoints: 2,
                      correctnessPoints: 6,
                      bonusPoints: 2,
                      appliedCorrections: [
                        {
                          pointCorrectionId: 7,
                          awardedBasePoints: 1,
                          awardedCorrectnessPoints: 0,
                          awardedBonusPoints: 0,
                          deductedBasePoints: 0,
                          deductedCorrectnessPoints: 0,
                          deductedBonusPoints: 0,
                          pointCorrection: {
                            createdAt: correctionDate,
                            reason: 'Lecturer reason',
                            studentReason: 'Student reason',
                          },
                        },
                        {
                          pointCorrectionId: 7,
                          awardedBasePoints: 0,
                          awardedCorrectnessPoints: 2,
                          awardedBonusPoints: 0,
                          deductedBasePoints: 0,
                          deductedCorrectnessPoints: 0,
                          deductedBonusPoints: 1,
                          pointCorrection: {
                            createdAt: correctionDate,
                            reason: 'Lecturer reason',
                            studentReason: 'Student reason',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  elementType: ElementType.CONTENT,
                  elementData: { options: {} },
                  options: { basePoints: true, pointsMultiplier: 3 },
                  liveQuizResponses: [],
                },
              ],
            },
          ],
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      participation: {
        findUnique: vi.fn().mockResolvedValue({ id: 1 }),
      },
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({ prisma, scope: UserLoginScope.EDUID })
    )

    await expect(
      caller.participant.studentAssessmentResults({ courseId: 'course-1' })
    ).resolves.toEqual({
      studentAssessmentResults: {
        liveQuizzes: [
          {
            id: 'quiz-1',
            activityId: 'quiz-1',
            displayName: 'Assessment Quiz',
            finishedAt,
            multiplier: 2,
            basePoints: 2,
            availableBasePoints: 2,
            correctnessPoints: 6,
            availableCorrectnessPoints: 6,
            bonusPoints: 2,
            availableBonusPoints: 2,
            corrections: [
              {
                id: 7,
                lecturerReason: 'Lecturer reason',
                studentReason: 'Student reason',
                awardedBasePoints: 1,
                awardedCorrectnessPoints: 2,
                awardedBonusPoints: 0,
                deductedBasePoints: 0,
                deductedCorrectnessPoints: 0,
                deductedBonusPoints: 1,
              },
            ],
          },
        ],
        practiceQuizzes: [],
        microLearnings: [],
        groupActivities: [],
      },
    })

    expect(courseFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'course-1', isAssessmentEnabled: true },
      })
    )
    expect(
      courseFindUnique.mock.calls[0]?.[0].include.liveQuizzes.include.blocks
        .include.elements.include.liveQuizResponses.where
    ).toEqual({ participantId: 'participant-1' })
  })

  test('rejects student assessment results for non-assessment participants', async () => {
    const prisma = {
      derivedPermission: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({ prisma, scope: UserLoginScope.FULL_ACCESS })
    )

    await expect(
      caller.participant.studentAssessmentResults({ courseId: 'course-1' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message:
        'Only logged in assessment participants can access assessment results',
    })
  })

  test('returns running live quizzes for a course', async () => {
    const courseFindUnique = vi.fn().mockResolvedValue({
      liveQuizzes: [
        {
          id: 'quiz-1',
          name: 'quiz-one',
          displayName: 'Quiz One',
          course: {
            id: 'course-1',
            displayName: 'Course One',
          },
        },
      ],
    })
    const prisma = {
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.courseRunningLiveQuizzes({ courseId: 'course-1' })
    ).resolves.toEqual({
      liveQuizzes: [
        {
          id: 'quiz-1',
          name: 'quiz-one',
          displayName: 'Quiz One',
          course: {
            id: 'course-1',
            displayName: 'Course One',
          },
        },
      ],
    })

    expect(courseFindUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: {
        liveQuizzes: {
          where: {
            status: PublicationStatus.PUBLISHED,
          },
          select: {
            id: true,
            name: true,
            displayName: true,
            course: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    })
  })

  test.each([
    { label: 'missing course', course: null },
    { label: 'no running live quizzes', course: { liveQuizzes: [] } },
  ])('returns no running live quizzes for $label', async ({ course }) => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(course),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.courseRunningLiveQuizzes({ courseId: 'course-1' })
    ).resolves.toEqual({
      liveQuizzes: [],
    })
  })

  test.each([
    {
      label: 'valid',
      liveQuiz: { id: '550e8400-e29b-41d4-a716-446655440001' },
      isAvailable: true,
    },
    { label: 'invalid', liveQuiz: null, isAvailable: false },
  ])(
    'returns $isAvailable for $label available live quiz validation',
    async ({ isAvailable, liveQuiz }) => {
      const liveQuizFindUnique = vi.fn().mockResolvedValue(liveQuiz)
      const prisma = {
        liveQuiz: {
          findUnique: liveQuizFindUnique,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(createContext({ prisma }))

      await expect(
        caller.participant.validateAvailableLiveQuiz({
          courseId: '550e8400-e29b-41d4-a716-446655440000',
          quizId: '550e8400-e29b-41d4-a716-446655440001',
        })
      ).resolves.toEqual({
        isAvailable,
      })

      expect(liveQuizFindUnique).toHaveBeenCalledWith({
        where: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          status: PublicationStatus.PUBLISHED,
          courseId: '550e8400-e29b-41d4-a716-446655440000',
        },
        select: { id: true },
      })
    }
  )

  test('rejects malformed live quiz validation input before querying', async () => {
    const liveQuizFindUnique = vi.fn()
    const prisma = {
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.validateAvailableLiveQuiz({
        courseId: '550e8400-e29b-41d4-a716-446655440000',
        quizId: 'not-a-live-quiz',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })

    expect(liveQuizFindUnique).not.toHaveBeenCalled()
  })

  test('returns course overview data for the course landing page', async () => {
    const groupDeadlineDate = new Date('2027-01-01T00:00:00.000Z')
    const messageDate = new Date('2025-06-01T00:00:00.000Z')
    const participantFindUnique = vi.fn().mockResolvedValue({
      participantGroups: [
        {
          id: 'group-1',
          name: 'Group A',
          code: 123456,
          averageMemberScore: 10,
          groupActivityScore: 5,
          messages: [
            {
              id: 7,
              content: 'Hello',
              createdAt: messageDate,
              updatedAt: messageDate,
              participant: {
                id: 'participant-1',
                username: 'student1',
                avatar: 'avatar.svg',
              },
            },
          ],
          participants: [
            {
              id: 'participant-1',
              username: 'student1',
              avatar: 'avatar.svg',
              xp: 0,
              leaderboards: [{ score: 9 }],
            },
          ],
        },
      ],
    })
    const prisma = {
      participant: {
        findUnique: participantFindUnique,
      },
      participation: {
        findUnique: vi.fn().mockResolvedValue({
          id: 11,
          isActive: true,
          course: {
            id: 'course-1',
            displayName: 'Course One',
            color: '#123456',
            description: 'Description',
            isGamificationEnabled: true,
            isAssessmentEnabled: false,
            groupDeadlineDate,
            isGroupCreationEnabled: true,
            maxGroupSize: 5,
            preferredGroupSize: 3,
            participantGroups: [
              {
                id: 'group-1',
                name: 'Group A',
                averageMemberScore: 10,
                groupActivityScore: 5,
              },
            ],
            awards: [
              {
                id: 3,
                order: 1,
                type: AwardType.PARTICIPANT,
                displayName: 'Winner',
                description: 'Top participant',
                participant: {
                  id: 'participant-1',
                  username: 'student1',
                  avatar: 'avatar.svg',
                },
                participantGroup: null,
              },
            ],
          },
          participant: {
            id: 'participant-1',
            avatar: 'avatar.svg',
            username: 'student1',
            xp: 0,
            participantGroups: [{ id: 'group-1' }],
          },
        }),
      },
      groupAssignmentPoolEntry: {
        findUnique: vi.fn().mockResolvedValue({ id: 1 }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.courseOverview({ courseId: 'course-1' })
    ).resolves.toMatchObject({
      courseOverview: {
        id: 'course-1-participant-1',
        inRandomGroupPool: true,
        participant: {
          id: 'participant-1',
          username: 'student1',
          level: 1,
          participantGroups: [{ id: 'group-1' }],
        },
        participation: { id: 11, isActive: true },
        course: {
          id: 'course-1',
          displayName: 'Course One',
          isGroupDeadlinePassed: false,
          awards: [
            {
              id: 3,
              type: AwardType.PARTICIPANT,
              participant: {
                id: 'participant-1',
                username: 'student1',
              },
            },
          ],
        },
        groupLeaderboard: [
          {
            id: 'group-1',
            name: 'Group A',
            score: 15,
            rank: 1,
            isMember: true,
          },
        ],
        groupLeaderboardStatistics: {
          participantCount: 1,
          averageScore: 15,
        },
      },
      participantGroups: [
        {
          id: 'group-1',
          score: 15,
          messages: [
            {
              id: 7,
              content: 'Hello',
              participant: {
                id: 'participant-1',
                username: 'student1',
              },
            },
          ],
          participants: [
            {
              id: 'participant-1',
              username: 'student1',
              score: 9,
              rank: 1,
              level: 1,
              isSelf: true,
            },
          ],
        },
      ],
    })
  })

  test('returns student course leaderboard entries', async () => {
    const prisma = {
      participation: {
        findUnique: vi.fn().mockResolvedValue({
          participant: { isProfilePublic: true },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            courseLeaderboard: { score: 10 },
            participant: {
              id: 'participant-1',
              username: 'student1',
              avatar: 'avatar.svg',
              isProfilePublic: true,
              xp: 0,
            },
          },
          {
            id: 2,
            courseLeaderboard: { score: 20 },
            participant: {
              id: 'participant-2',
              username: 'student2',
              avatar: 'private.svg',
              isProfilePublic: false,
              xp: 0,
            },
          },
        ]),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.courseLeaderboard({
        courseId: 'course-1',
        mode: 'course',
      })
    ).resolves.toEqual({
      leaderboard: [
        {
          id: 2,
          participantId: 'participant-2',
          username: 'Anonymous',
          avatar: null,
          score: 20,
          isSelf: false,
          rank: 1,
          level: 1,
        },
        {
          id: 1,
          participantId: 'participant-1',
          username: 'student1',
          avatar: 'avatar.svg',
          score: 10,
          isSelf: true,
          rank: 2,
          level: 1,
        },
      ],
      leaderboardStatistics: {
        participantCount: 2,
        averageScore: 15,
      },
    })
  })

  test('returns course group activities and group activity instances', async () => {
    const scheduledStartAt = new Date('2025-06-01T00:00:00.000Z')
    const scheduledEndAt = new Date('2025-06-15T00:00:00.000Z')
    const decisionsSubmittedAt = new Date('2025-06-02T00:00:00.000Z')
    const groupActivityInstanceFindMany = vi.fn().mockResolvedValue([
      {
        id: 5,
        decisionsSubmittedAt,
        resultsComputedAt: null,
        results: { passed: true },
        groupActivityId: 'activity-1',
      },
    ])
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          groupActivities: [
            {
              id: 'activity-1',
              displayName: 'Activity One',
              status: PublicationStatus.PUBLISHED,
              description: 'Description',
              scheduledStartAt,
              scheduledEndAt,
            },
          ],
        }),
      },
      groupActivityInstance: {
        findMany: groupActivityInstanceFindMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.courseGroupActivities({ courseId: 'course-1' })
    ).resolves.toEqual({
      groupActivities: [
        {
          id: 'activity-1',
          displayName: 'Activity One',
          status: PublicationStatus.PUBLISHED,
          description: 'Description',
          scheduledStartAt,
          scheduledEndAt,
        },
      ],
    })
    await expect(
      caller.participant.groupActivityInstances({
        courseId: 'course-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({
      groupActivityInstances: [
        {
          id: 5,
          decisionsSubmittedAt,
          resultsComputedAt: null,
          results: { passed: true },
          groupActivityId: 'activity-1',
        },
      ],
    })
    expect(groupActivityInstanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          group: {
            id: 'group-1',
            courseId: 'course-1',
            participants: {
              some: {
                id: 'participant-1',
              },
            },
          },
        }),
      })
    )
  })

  test('returns practice courses with element stacks ordered by end date', async () => {
    const prisma = {
      participation: {
        findMany: vi.fn().mockResolvedValue([
          {
            course: {
              id: 'course-old',
              displayName: 'Old Course',
              endDate: new Date('2025-01-01T00:00:00.000Z'),
              elementStacks: [{ id: 1 }],
            },
          },
          {
            course: {
              id: 'course-empty',
              displayName: 'Empty Course',
              endDate: new Date('2026-01-01T00:00:00.000Z'),
              elementStacks: [],
            },
          },
          {
            course: {
              id: 'course-new',
              displayName: 'New Course',
              endDate: new Date('2026-01-01T00:00:00.000Z'),
              elementStacks: [{ id: 2 }],
            },
          },
        ]),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.participant.practiceCourses()).resolves.toEqual({
      practiceCourses: [
        { id: 'course-new', displayName: 'New Course' },
        { id: 'course-old', displayName: 'Old Course' },
      ],
    })
  })

  test('returns published practice quizzes grouped by participant courses', async () => {
    const participationFindMany = vi.fn().mockResolvedValue([
      {
        course: {
          id: 'course-old',
          displayName: 'Old Course',
          endDate: new Date('2024-01-01T00:00:00.000Z'),
          practiceQuizzes: [{ id: 'quiz-old', displayName: 'Old Quiz' }],
        },
      },
      {
        course: {
          id: 'course-empty',
          displayName: 'Empty Course',
          endDate: new Date('2026-01-01T00:00:00.000Z'),
          practiceQuizzes: [],
        },
      },
      {
        course: {
          id: 'course-new',
          displayName: 'New Course',
          endDate: new Date('2025-01-01T00:00:00.000Z'),
          practiceQuizzes: [
            { id: 'quiz-new-1', displayName: 'New Quiz 1' },
            { id: 'quiz-new-2', displayName: 'New Quiz 2' },
          ],
        },
      },
    ])
    const prisma = {
      participation: {
        findMany: participationFindMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.participant.practiceQuizList()).resolves.toEqual({
      practiceQuizList: [
        {
          id: 'course-new',
          displayName: 'New Course',
          practiceQuizzes: [
            { id: 'quiz-new-1', displayName: 'New Quiz 1' },
            { id: 'quiz-new-2', displayName: 'New Quiz 2' },
          ],
        },
        {
          id: 'course-old',
          displayName: 'Old Course',
          practiceQuizzes: [{ id: 'quiz-old', displayName: 'Old Quiz' }],
        },
      ],
    })

    expect(participationFindMany).toHaveBeenCalledWith({
      where: {
        participantId: 'participant-1',
      },
      select: {
        course: {
          select: {
            id: true,
            displayName: true,
            endDate: true,
            practiceQuizzes: {
              where: {
                status: PublicationStatus.PUBLISHED,
                isDeleted: false,
              },
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    })
  })

  test('returns published practice quizzes for the course overview page', async () => {
    const courseFindUnique = vi.fn().mockResolvedValue({
      id: 'course-1',
      displayName: 'Course One',
      practiceQuizzes: [
        {
          id: 'quiz-1',
          name: 'practice-quiz-1',
          displayName: 'Practice Quiz One',
        },
        {
          id: 'quiz-2',
          name: 'practice-quiz-2',
          displayName: 'Practice Quiz Two',
        },
      ],
    })
    const prisma = {
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.participant.coursePublishedPracticeQuizzes({
        courseId: 'course-1',
      })
    ).resolves.toEqual({
      practiceQuizzes: [
        {
          id: 'quiz-1',
          name: 'practice-quiz-1',
          displayName: 'Practice Quiz One',
          course: {
            id: 'course-1',
            displayName: 'Course One',
          },
        },
        {
          id: 'quiz-2',
          name: 'practice-quiz-2',
          displayName: 'Practice Quiz Two',
          course: {
            id: 'course-1',
            displayName: 'Course One',
          },
        },
      ],
    })

    expect(courseFindUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: {
        id: true,
        displayName: true,
        practiceQuizzes: {
          where: {
            status: PublicationStatus.PUBLISHED,
            isDeleted: false,
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    })
  })

  test('returns no practice quizzes when the course is missing', async () => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.participant.coursePublishedPracticeQuizzes({
        courseId: 'missing-course',
      })
    ).resolves.toEqual({ practiceQuizzes: [] })
  })

  test('returns published microlearnings for the course overview page', async () => {
    const scheduledStartAt = new Date('2026-06-03T08:00:00.000Z')
    const scheduledEndAt = new Date('2026-06-03T09:00:00.000Z')
    const courseFindUnique = vi.fn().mockResolvedValue({
      id: 'course-1',
      displayName: 'Course One',
      microLearnings: [
        {
          id: 'microlearning-1',
          name: 'microlearning-1',
          displayName: 'Microlearning One',
          scheduledStartAt,
          scheduledEndAt,
        },
      ],
    })
    const prisma = {
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.participant.coursePublishedMicroLearnings({
        courseId: 'course-1',
      })
    ).resolves.toEqual({
      microLearnings: [
        {
          id: 'microlearning-1',
          name: 'microlearning-1',
          displayName: 'Microlearning One',
          scheduledStartAt: scheduledStartAt.toISOString(),
          scheduledEndAt: scheduledEndAt.toISOString(),
          course: {
            id: 'course-1',
            displayName: 'Course One',
          },
        },
      ],
    })

    expect(courseFindUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: {
        id: true,
        displayName: true,
        microLearnings: {
          where: {
            status: PublicationStatus.PUBLISHED,
            isDeleted: false,
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            displayName: true,
            scheduledStartAt: true,
            scheduledEndAt: true,
          },
        },
      },
    })
  })

  test('returns no microlearnings when the course is missing', async () => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.participant.coursePublishedMicroLearnings({
        courseId: 'missing-course',
      })
    ).resolves.toEqual({ microLearnings: [] })
  })

  test('rejects participant course reads for lecturers', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(caller.participant.courses()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(caller.participant.participations()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      caller.participant.courseStudentTimelines()
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      caller.participant.courseGroupActivities({ courseId: 'course-1' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      caller.participant.groupActivityInstances({
        courseId: 'course-1',
        groupId: 'group-1',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
