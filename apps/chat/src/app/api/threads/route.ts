import { JWTPayload, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { ThreadService } from '../../services/threads'

/**
 * Retrieves all chat threads for the authenticated participant ordered by most recently updated.
 * Used by the frontend to display threads in the sidebar.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const participantToken = req.cookies.get('participant_token')?.value

  if (!participantToken) {
    return NextResponse.json(
      { error: 'No authentication token found' },
      { status: 401 }
    )
  }

  let participantData: JWTPayload
  try {
    const jwtPayload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
    participantData = jwtPayload.payload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    )
  }

  try {
    const threads = await ThreadService.getAllThreads(
      participantData.sub as string,
      chatbotId
    )
    return NextResponse.json(threads)
  } catch (error) {
    console.error('Failed to fetch threads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    )
  }
}

/**
 * Creates a new chat thread with an optional title for the authenticated participant.
 * Used when explicitly creating a thread or starting a new conversation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const participantToken = req.cookies.get('participant_token')?.value

  if (!participantToken) {
    return NextResponse.json(
      { error: 'No authentication token found' },
      { status: 401 }
    )
  }

  let participantData: JWTPayload
  try {
    const jwtPayload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
    participantData = jwtPayload.payload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    )
  }

  try {
    const { title } = await req.json()
    const thread = await ThreadService.createThread(
      participantData.sub as string,
      chatbotId,
      title
    )
    return NextResponse.json(thread)
  } catch (error) {
    console.error('Failed to create thread:', error)
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    )
  }
}
