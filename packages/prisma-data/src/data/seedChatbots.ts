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
      name: 'BF Disclaimer',
      title: 'Disclaimer',
      mediaUrl:
        'https://api.cast.switch.ch/p/106/embedPlaykitJs/uiconf_id/23449004/partner_id/106?iframeembed=true&playerId=kaltura_player&entry_id=0_vfk2yyvo',
      mediaType: 'video',
      introText: `
Wir möchten Dich herzlich zu unserem Chatbot (Spitzname "Benibot") begrüssen. Der Chatbot soll Dein **persönlicher Tutor** im Fachbereich Banking und Finance sein.


Das Wissen des Chatbots enthält Kursmaterialien wie **Vorlesungsskripte, FAQs, Vorlesungsaufzeichnungen** und das **Financewiki**. Tausche Dich mit dem Chatbot einfach darüber aus, stelle konkrete Fragen, oder sei kreativ und lass Dir z.B. Übungsfragen generieren.


Der Chatbot bietet mehrere Modi, z.B. "Tutor" oder "Explainer". Wähle den Modus, der am besten zu Deinen Bedürfnissen passt. Die **Nutzung ist begrenzt** auf eine Anzahl von **Credits**, um einen fairen Zugang für alle Nutzenden zu gewährleisten. Sobald der Saldo null erreicht, kannst Du immer noch mit den günstigsten Modellen chatten.


Der Chatbot soll **kursbezogene Fragen** im Kurs "Banking and Finance I/II" beantworten. Bitte vermeide Fragen ausserhalb dieses Rahmens, um die Relevanz zu wahren. Gib keinerlei persönliche Informationen in den Chatbot ein.
`,

      owner: {
        connect: { id: USER_ID_TEST },
      },
    },
    update: {},
  })

  const testChatbot = await prisma.chatbot.upsert({
    where: { id: CHATBOT_ID_TEST },
    update: {
      modelSelection: true,
      allowedModelIds: ['auto', 'gpt-5.6-luna'],
    },
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
      modelSelection: true, // Allow model selection for testing
      allowedModelIds: ['auto', 'gpt-5.6-luna'],
      disclaimerId: testDisclaimer.id,
    },
  })

  return {
    testChatbot,
    testDisclaimer,
  }
}
