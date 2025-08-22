import { PrismaClient } from '@klicker-uzh/prisma'

const prisma = new PrismaClient()

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const { title } = await req.json()

    await prisma.chatThread.update({
      where: { id: threadId },
      data: { title },
    })

    return Response.json({ message: 'Thread title updated' })
  } catch (error) {
    console.error('Failed to update thread title:', error)
    return Response.json(
      { error: 'Failed to update thread title' },
      { status: 500 }
    )
  }
}
