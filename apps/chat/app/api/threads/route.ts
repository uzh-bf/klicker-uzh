import { prisma } from '@klicker-uzh/prisma'

export async function GET() {
  try {
    const threads = await prisma.chatThread.findMany({
      include: {
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return Response.json(
      threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        messageCount: thread._count.messages,
      }))
    )
  } catch (error) {
    console.error('Failed to fetch threads:', error)
    return Response.json([], { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { title } = await req.json()

    const thread = await prisma.chatThread.create({
      data: {
        title,
      },
    })

    return Response.json({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      messageCount: 0,
    })
  } catch (error) {
    console.error('Failed to create thread:', error)
    return Response.json({ error: 'Failed to create thread' }, { status: 500 })
  }
}
