import { getChatbotOr404 } from '@/src/lib/server/apiGuards'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Retrieves model details for a specific chatbot.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params

  try {
    const chatbotResult = await getChatbotOr404(chatbotId, {
      id: true,
      name: true,
      description: true,
      avatar: true,
      modelSelection: true,
      systemPrompts: true,
      disclaimerId: true,
    })

    if ('response' in chatbotResult) {
      return chatbotResult.response
    }

    return NextResponse.json(chatbotResult.chatbot)
  } catch (error) {
    console.error('Failed to fetch model details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model details' },
      { status: 500 }
    )
  }
}
