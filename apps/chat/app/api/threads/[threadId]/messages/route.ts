import { prisma } from '@klicker-uzh/prisma'

/**
 * Retrieves all messages for a specific thread in chronological order.
 * Used by the frontend to load conversation history when switching threads.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const messages = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    })

    return Response.json(
      messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        role: msg.role,
        content: msg.content,
        parentId: (msg as { parentId?: string | null }).parentId || null,
        createdAt: msg.createdAt.toISOString(),
        updatedAt: msg.updatedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}
