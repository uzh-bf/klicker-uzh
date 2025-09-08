import { ThreadService } from '../../services/threads'

/**
 * Retrieves all chat threads ordered by most recently updated.
 * Used by the frontend to display threads in the sidebar.
 */
export async function GET() {
  try {
    const threads = await ThreadService.getAllThreads()
    return Response.json(threads)
  } catch (error) {
    console.error('Failed to fetch threads:', error)
    return Response.json([], { status: 500 })
  }
}

/**
 * Creates a new chat thread with an optional title.
 * Used when explicitly creating a thread or starting a new conversation.
 */
export async function POST(req: Request) {
  try {
    const { title } = await req.json()
    const thread = await ThreadService.createThread(title)
    return Response.json(thread)
  } catch (error) {
    console.error('Failed to create thread:', error)
    return Response.json({ error: 'Failed to create thread' }, { status: 500 })
  }
}
