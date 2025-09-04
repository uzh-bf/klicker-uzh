import { prisma } from '@klicker-uzh/prisma'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    })

    if (!thread) {
      return Response.json({ error: 'Thread not found' }, { status: 404 })
    }

    return Response.json({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      message_count: thread._count.messages,
    })
  } catch (error) {
    console.error('Failed to fetch thread:', error)
    return Response.json({ error: 'Failed to fetch thread' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params

    await prisma.chatThread.delete({
      where: { id: threadId },
    })

    return Response.json({ message: 'Thread deleted' })
  } catch (error) {
    console.error('Failed to delete thread:', error)
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }
}
