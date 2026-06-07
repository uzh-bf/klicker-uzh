import { ElementOrderType, PublicationStatus } from '@klicker-uzh/prisma/client'
import {
  collectPracticeQuizAssetManifest,
  getPracticeQuizDownloadSnapshot,
} from '../src/services/practiceQuizzes.js'

function createPracticeQuizDownloadContext(quiz: any = null) {
  const practiceQuiz = {
    findFirst: vi.fn().mockResolvedValue(quiz),
  }

  return {
    ctx: {
      user: { sub: 'participant-id' },
      prisma: { practiceQuiz },
    } as any,
    practiceQuiz,
  }
}

describe('practice quiz download snapshots', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses a published non-assessment active-participant access filter', async () => {
    const { ctx, practiceQuiz } = createPracticeQuizDownloadContext()

    await expect(
      getPracticeQuizDownloadSnapshot({ id: 'quiz-id' }, ctx)
    ).resolves.toBeNull()

    expect(practiceQuiz.findFirst).toHaveBeenCalledTimes(1)
    expect(practiceQuiz.findFirst.mock.calls[0]![0]).toMatchObject({
      where: {
        id: 'quiz-id',
        status: PublicationStatus.PUBLISHED,
        isDeleted: false,
        isAssessmentEnabled: false,
        course: {
          isAssessmentEnabled: false,
          participations: {
            some: { participantId: 'participant-id', isActive: true },
          },
        },
      },
      include: {
        course: true,
        stacks: {
          include: {
            elements: {
              include: {
                responses: {
                  where: { participantId: 'participant-id' },
                  select: {
                    correctCount: true,
                    correctCountStreak: true,
                    lastCorrectAt: true,
                    nextDueAt: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    })
  })

  it('returns metadata, quiz data, and a deduplicated asset manifest', async () => {
    const quiz = {
      id: 'quiz-id',
      displayName: 'Offline practice',
      description:
        'Intro ![diagram](/assets/intro.png) and [notes](/docs/notes.pdf)',
      orderType: ElementOrderType.SEQUENTIAL,
      updatedAt: new Date('2026-06-01T12:00:00.000Z'),
      stacks: [
        {
          id: 1,
          description:
            '<img src="https://cdn.example.org/stack.webp?size=large">',
          elements: [
            {
              id: 10,
              elementData: {
                content:
                  'See https://cdn.example.org/plot.svg and ![again](/assets/intro.png)',
                explanation:
                  '<video poster="/assets/poster.jpg" src="/assets/demo.mp4"></video>',
                options: {
                  choices: [
                    {
                      value:
                        'Choice image ![choice](https://cdn.example.org/choice.png)',
                      feedback: 'Feedback image ![fb](/assets/feedback.png)',
                    },
                  ],
                  cases: [
                    {
                      description:
                        'Case image ![case](https://cdn.example.org/case.jpeg)',
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    }
    const { ctx } = createPracticeQuizDownloadContext(quiz)

    const result = await getPracticeQuizDownloadSnapshot({ id: 'quiz-id' }, ctx)

    expect(result).toMatchObject({
      schemaVersion: 1,
      quizRevision: 'quiz-id:2026-06-01T12:00:00.000Z',
      downloadedAt: new Date('2026-06-07T10:00:00.000Z'),
      validUntil: new Date('2026-07-07T10:00:00.000Z'),
      assetManifest: [
        '/assets/demo.mp4',
        '/assets/feedback.png',
        '/assets/intro.png',
        '/assets/poster.jpg',
        '/docs/notes.pdf',
        'https://cdn.example.org/case.jpeg',
        'https://cdn.example.org/choice.png',
        'https://cdn.example.org/plot.svg',
        'https://cdn.example.org/stack.webp?size=large',
      ],
      quiz: expect.objectContaining({
        id: 'quiz-id',
        numOfStacks: 1,
        stacks: quiz.stacks,
      }),
    })
  })

  it('ignores non-media and unsafe URLs in asset extraction', () => {
    const manifest = collectPracticeQuizAssetManifest({
      description:
        '[page](https://example.org/page) ![inline](data:image/png;base64,abc) [email](mailto:test@example.org) ![safe](/safe/image.png) ![file](file:///tmp/secret.png) ![ftp](ftp://example.org/file.png) ![custom](capacitor://localhost/file.png) ![protocol](//example.org/file.png)',
      stacks: [
        {
          description: '![script](javascript:alert(1))',
          elements: [
            {
              elementData: {
                content: '<a href="/not-an-asset">link</a>',
                explanation: 'plain text answer.jpg',
              },
            },
          ],
        },
      ],
    })

    expect(manifest).toEqual(['/safe/image.png'])
  })
})
