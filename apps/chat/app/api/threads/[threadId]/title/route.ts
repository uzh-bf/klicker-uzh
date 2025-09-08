import { ThreadService } from '../../../../services/threads'

/**
 * Updates the title of a specific thread.
 * Used when user renames a thread or system auto-generates titles.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const { title } = await req.json()

    await ThreadService.updateThreadTitle(threadId, title)
    return Response.json({ message: 'Thread title updated' })
  } catch (error) {
    console.error('Failed to update thread title:', error)
    return Response.json(
      { error: 'Failed to update thread title' },
      { status: 500 }
    )
  }
}
