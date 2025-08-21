const BACKEND_URL = process.env.BACKEND_URL

export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const response = await fetch(
      `${BACKEND_URL}/api/threads/${threadId}/messages`
    )

    if (!response.ok) {
      return Response.json([], { status: response.status })
    }

    const messages = await response.json()
    return Response.json(messages)
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return Response.json([], { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const body = await req.json()

    const response = await fetch(
      `${BACKEND_URL}/api/threads/${threadId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      console.error(
        `Backend returned ${response.status}: ${response.statusText}`
      )
      return Response.json(
        { error: 'Failed to save message' },
        { status: response.status }
      )
    }

    const message = await response.json()
    return Response.json(message)
  } catch (error) {
    console.error('Failed to save message:', error)
    return Response.json({ error: 'Failed to save message' }, { status: 500 })
  }
}
