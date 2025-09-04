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
        threadId: msg.threadId,
        role: msg.role,
        content: msg.content,
        parentId: msg.parentId || null,
        createdAt: msg.createdAt.toISOString(),
        updatedAt: msg.updatedAt.toISOString(),
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
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      parentId: (message as { parentId?: string | null }).parentId || null,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Failed to save message:', error)
    return Response.json({ error: 'Failed to save message' }, { status: 500 })
  }
}
