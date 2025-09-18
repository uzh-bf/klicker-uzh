import { prisma } from '@klicker-uzh/prisma'

export class ChatbotsService {
  static async getChatbotById(chatbotId: string) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
    })
    return chatbot
  }
}
