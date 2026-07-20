import { prisma } from '@klicker-uzh/prisma'

export class ChatbotsService {
  static async getChatbotById(chatbotId: string) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
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
