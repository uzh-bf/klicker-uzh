import { prisma } from '@klicker-uzh/prisma'

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
        thread_id: msg.threadId,
        role: msg.role,
        content: msg.content,
        parent_id: msg.parentId || null,
        created_at: msg.createdAt.toISOString(),
        updated_at: msg.updatedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const { role, content, parentId } = await req.json()

    const message = await prisma.chatMessage.create({
      data: {
        threadId,
        role,
        content,
        parentId: parentId || null,
      },
    })

    // update thread's timestamp
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    })

    return Response.json({
      id: message.id,
      thread_id: message.threadId,
      role: message.role,
      content: message.content,
      parent_id: (message as { parentId?: string | null }).parentId || null,
      created_at: message.createdAt.toISOString(),
      updated_at: message.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Failed to save message:', error)
    return Response.json({ error: 'Failed to save message' }, { status: 500 })
  }
}
