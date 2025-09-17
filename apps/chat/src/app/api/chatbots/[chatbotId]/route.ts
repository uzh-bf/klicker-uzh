import { ChatbotsService } from '@/src/services/chatbots'
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
    const modelDetails = await ChatbotsService.getChatbotById(chatbotId)
    return NextResponse.json(modelDetails)
  } catch (error) {
    console.error('Failed to fetch model details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model details' },
      { status: 500 }
    )
  }
}
