import * as Prisma from '../client.js'
import { USER_ID_TEST } from './constants.js'

export const CHATBOT_ID_TEST = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'

export const CHATBOT_AVATAR_HASH = 'chatbot-assistant-avatar'

export async function seedChatbots(prisma: Prisma.PrismaClient) {
  const testChatbot = await prisma.chatbot.upsert({
    where: { id: CHATBOT_ID_TEST },
    update: {},
    create: {
      id: CHATBOT_ID_TEST,
      name: 'Bennibot',
      description:
        'A helpful chatbot for answering questions about KlickerUZH and educational content.',
      avatar: CHATBOT_AVATAR_HASH,
      ownerId: USER_ID_TEST,
    },
  })

  return {
    testChatbot,
  }
}
