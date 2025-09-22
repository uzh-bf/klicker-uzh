import * as Prisma from '@klicker-uzh/prisma/client'
import { readFileSync } from 'fs'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants.js'

export const CHATBOT_ID_TEST = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'

export const CHATBOT_AVATAR_HASH = '217ed4744160a52219711edc6636550d49b6d672'

const tutorPrompt = readFileSync(
  './src/data/data/tutorMode.txt',
  'utf-8'
).trim()

const explainerPrompt = readFileSync(
  './src/data/data/explainerMode.txt',
  'utf-8'
).trim()

export async function seedChatbots(prisma: Prisma.PrismaClient) {
  const testDisclaimer = await prisma.chatbotDisclaimer.upsert({
    where: { id: CHATBOT_ID_TEST },
    create: {
      id: CHATBOT_ID_TEST,
      name: 'Default Disclaimer',
      title: 'Disclaimer',
      description: 'Please read this disclaimer carefully.',
      introText:
        'Benibot is a helpful assistant for answering questions about KlickerUZH and educational content. However, please note that Benibot may not always provide accurate or complete information. Always verify critical information from reliable sources. Use Benibot at your own risk.',
      createdBy: {
        connect: { id: USER_ID_TEST },
      },
    },
    update: {},
  })

  const testChatbot = await prisma.chatbot.upsert({
    where: { id: CHATBOT_ID_TEST },
    update: {},
    create: {
      id: CHATBOT_ID_TEST,
      name: 'Benibot',
      description:
        'A helpful chatbot for answering questions about KlickerUZH and educational content.',
      avatar: CHATBOT_AVATAR_HASH,
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      systemPrompts: {
        tutor: {
          prompt: tutorPrompt,
          description: 'Acts as a patient and knowledgeable tutor.',
        },
        explainer: {
          prompt: explainerPrompt,
          description: 'Act as an expert explainer.',
        },
      },
      creditInitialCredits: 100, // Generous amount for testing
      creditResetPeriod: 'WEEKLY', // Weekly reset for testing
      creditResetAmount: 50, // Add 50 credits on reset
      creditMaxCredits: 100, // Max 100 credits
      modelSelection: false, // Automatic model selection for testing
      disclaimerId: testDisclaimer.id,
    },
  })

  return {
    testChatbot,
    testDisclaimer,
  }
}
