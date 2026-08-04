import { UserRole } from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import { getParticipantCourseChatbots } from '../src/services/chatbots.js'

describe('participant course chatbots', () => {
  test('returns only public chatbot fields for enrolled course participants', async () => {
    const ctx = {
      prisma: {
        participation: {
          findUnique: vi.fn().mockResolvedValue({ id: 1 }),
        },
        chatbot: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'chatbot-1',
              name: 'Tutor',
              description: 'Course tutor',
              avatar: 'robot',
              openaiApiKey: 'encrypted-secret',
              systemPrompts: { tutor: { prompt: 'hidden' } },
            },
          ]),
        },
      },
      user: { role: UserRole.PARTICIPANT, sub: 'participant-1' },
    } as any

    const chatbots = await getParticipantCourseChatbots(
      { courseId: 'course-1' },
      ctx
    )

    expect(ctx.prisma.participation.findUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
    })
    expect(ctx.prisma.chatbot.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        avatar: true,
      },
      where: { courseId: 'course-1' },
    })
    expect(chatbots).toEqual([
      {
        id: 'chatbot-1',
        name: 'Tutor',
        description: 'Course tutor',
        avatar: 'robot',
      },
    ])
    expect(JSON.stringify(chatbots)).not.toContain('encrypted-secret')
    expect(JSON.stringify(chatbots)).not.toContain('hidden')
  })

  test('returns no chatbots when participation is missing', async () => {
    const ctx = {
      prisma: {
        participation: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        chatbot: {
          findMany: vi.fn(),
        },
      },
      user: { role: UserRole.PARTICIPANT, sub: 'participant-1' },
    } as any

    await expect(
      getParticipantCourseChatbots({ courseId: 'course-1' }, ctx)
    ).resolves.toEqual([])
    expect(ctx.prisma.chatbot.findMany).not.toHaveBeenCalled()
  })
})
