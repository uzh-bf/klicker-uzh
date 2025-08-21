const BACKEND_URL = process.env.BACKEND_URL

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const { title } = await req.json()

    const response = await fetch(
      `${BACKEND_URL}/api/threads/${threadId}/title`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    )

    if (!response.ok) {
      return Response.json({ error: 'Thread not found' }, { status: 404 })
    }

    return Response.json({ message: 'Thread title updated' })
  } catch (error) {
    console.error('Failed to update thread title:', error)
    return Response.json(
      { error: 'Failed to update thread title' },
      { status: 500 }
    )
  }
}
