const BACKEND_URL = process.env.BACKEND_URL

export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const response = await fetch(`${BACKEND_URL}/api/threads/${threadId}`)

    if (!response.ok) {
      return Response.json({ error: 'Thread not found' }, { status: 404 })
    }

    const thread = await response.json()
    return Response.json(thread)
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
    const response = await fetch(`${BACKEND_URL}/api/threads/${threadId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      return Response.json({ error: 'Thread not found' }, { status: 404 })
    }

    return Response.json({ message: 'Thread deleted' })
  } catch (error) {
    console.error('Failed to delete thread:', error)
    return Response.json({ error: 'Failed to delete thread' }, { status: 500 })
  }
}
