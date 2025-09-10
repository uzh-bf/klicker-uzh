import { JWTPayload, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { ThreadService } from '../../../../services/threads'

/**
 * Updates the title of a specific thread for the authenticated participant.
 * Used when user renames a thread or system auto-generates titles.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string; threadId: string }> }
) {
  const { chatbotId, threadId } = await params
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

    const updatedThread = await ThreadService.updateThreadTitle(
      threadId,
      participantData.sub as string,
      chatbotId,
      title
    )

    if (!updatedThread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Thread title updated',
      thread: updatedThread,
    })
  } catch (error) {
    console.error('Failed to update thread title:', error)
    return NextResponse.json(
      { error: 'Failed to update thread title' },
      { status: 500 }
    )
  }
}
