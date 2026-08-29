import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'

export class ChatbotsService {
  static async getChatbotById(chatbotId: string) {
    // Participants may only reach a PUBLISHED chatbot; keep this read behind the
    // same gate as the route handlers so the seam cannot leak a draft or
    // in-review bot's prompts if it is wired up later.
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, status: ChatbotStatus.PUBLISHED },
      select: {
        id: true,
        name: true,
        description: true,
        avatar: true,
        modelSelection: true,
        systemPrompts: true,
        disclaimerId: true,
      },
    })
    return chatbot
  }
}
