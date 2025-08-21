const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/threads`)
    const threads = await response.json()

    return Response.json(threads)
  } catch (error) {
    console.error('Failed to fetch threads:', error)
    return Response.json([], { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { title } = await req.json()

    const response = await fetch(`${BACKEND_URL}/api/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })

    const thread = await response.json()
    return Response.json(thread)
  } catch (error) {
    console.error('Failed to create thread:', error)
    return Response.json({ error: 'Failed to create thread' }, { status: 500 })
  }
}
