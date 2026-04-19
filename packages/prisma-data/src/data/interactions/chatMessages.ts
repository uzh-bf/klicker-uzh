import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'

import type { Calendar, ProfileBudget, Rng } from './helpers.js'

// Canned user prompts drawn from study-topic phrasings. Script 10 runs
// TF-IDF over ``content[0].text`` on user-role messages, so this list has
// to produce discriminable clusters — we group the prompts by topic so
// HDBSCAN can actually find structure.
const USER_PROMPTS_BY_TOPIC: Record<string, string[]> = {
  capm: [
    'Can you explain the CAPM model step by step?',
    'What is beta in the CAPM formula?',
    'How is the risk-free rate chosen for CAPM?',
    'Why is CAPM criticised for single-factor risk?',
  ],
  portfolio: [
    'How do I construct an efficient portfolio?',
    'What is the Markowitz mean-variance frontier?',
    'Can you show me the minimum variance portfolio calculation?',
    'Explain portfolio diversification benefits please',
  ],
  options: [
    'What is a put-call parity relationship?',
    'How does Black-Scholes price a European call?',
    'Explain implied volatility versus historical volatility',
    'What are the Greeks for options pricing?',
  ],
  bonds: [
    'How is duration computed for a coupon bond?',
    'Explain convexity and its relation to price changes',
    'What is the yield to maturity of a bond?',
    'How does credit rating affect bond spreads?',
  ],
  derivatives: [
    'Explain forward versus futures contracts',
    'What is a swap and how is it priced?',
    'How do interest-rate swaps work in practice?',
    'Can you walk through hedging with futures?',
  ],
}

const ASSISTANT_RESPONSES: string[] = [
  'Sure, happy to explain. The core idea here is...',
  'Great question. Let me break this down step by step...',
  'This is a common point of confusion. In short...',
  'You can think of it this way: consider a simple case...',
  'Excellent — let me walk through the derivation...',
  'The textbook intuition is useful here. Start with...',
]

export async function seedChatInteractions({
  prisma,
  courseId,
  participantIds,
  profiles,
  calendar,
  rng,
}: {
  prisma: PrismaClient
  courseId: string
  participantIds: readonly string[]
  profiles: Map<string, ProfileBudget>
  calendar: Calendar
  rng: Rng
}): Promise<{ threads: number; messages: number }> {
  const chatbots = await prisma.chatbot.findMany({
    where: { courseId },
    select: { id: true, disclaimerId: true },
  })
  if (chatbots.length === 0) return { threads: 0, messages: 0 }

  const topics = Object.keys(USER_PROMPTS_BY_TOPIC)
  let threadCount = 0
  let messageCount = 0

  for (const participantId of participantIds) {
    const budget = profiles.get(participantId)
    if (!budget || budget.chatMessagesTarget === 0) continue

    const chatbot = rng.pick(chatbots)

    // ChatUsageCredits with acceptedDisclaimerId set is the §3.9 privacy gate
    // read by scripts 8/9/11 — without it no chat analytics get computed.
    if (chatbot.disclaimerId) {
      const acceptedAt = calendar.sample(rng)
      await prisma.chatUsageCredits.upsert({
        where: {
          participantId_chatbotId: { participantId, chatbotId: chatbot.id },
        },
        create: {
          participantId,
          chatbotId: chatbot.id,
          total: 1000,
          current: 1000,
          acceptedDisclaimerId: chatbot.disclaimerId,
          disclaimerAcceptedAt: acceptedAt,
        },
        update: {
          acceptedDisclaimerId: chatbot.disclaimerId,
          disclaimerAcceptedAt: acceptedAt,
        },
      })
    }
    // Bunch messages into 1-3 threads per active participant so AggregatedChatbotAnalytics.threadsPerParticipant has variance.
    const threadsForParticipant = Math.min(
      3,
      Math.max(1, Math.ceil(budget.chatMessagesTarget / 8))
    )
    const messagesPerThread = Math.ceil(
      budget.chatMessagesTarget / threadsForParticipant
    )

    for (let t = 0; t < threadsForParticipant; t++) {
      const topic = rng.pick(topics)
      const userPrompts = USER_PROMPTS_BY_TOPIC[topic]!
      const threadStartedAt = calendar.sample(rng)

      const thread = await prisma.chatThread.create({
        data: {
          id: randomUUID(),
          title: `Q on ${topic}`,
          participantId,
          chatbotId: chatbot.id,
          createdAt: threadStartedAt,
          updatedAt: threadStartedAt,
        },
      })
      threadCount++

      let previousMessageId: string | null = null
      // messagesPerThread is the number of user turns; each spawns an
      // assistant reply, so we produce 2 × messagesPerThread messages.
      let currentTs = threadStartedAt.getTime()
      for (let m = 0; m < messagesPerThread; m++) {
        const userMessageId = randomUUID()
        currentTs += rng.int(30, 300) * 1000 // user thinks 30s – 5min
        const userText = rng.pick(userPrompts)
        await prisma.chatMessage.create({
          data: {
            id: userMessageId,
            threadId: thread.id,
            parentId: previousMessageId,
            role: 'user',
            content: [{ type: 'text', text: userText }],
            chatMode: 'tutor',
            createdAt: new Date(currentTs),
            updatedAt: new Date(currentTs),
          },
        })
        messageCount++

        const assistantMessageId = randomUUID()
        currentTs += rng.int(2, 15) * 1000 // assistant answers within 15s
        await prisma.chatMessage.create({
          data: {
            id: assistantMessageId,
            threadId: thread.id,
            parentId: userMessageId,
            role: 'assistant',
            content: [{ type: 'text', text: rng.pick(ASSISTANT_RESPONSES) }],
            chatMode: 'tutor',
            modelId: 'gpt-4o-mini',
            createdAt: new Date(currentTs),
            updatedAt: new Date(currentTs),
          },
        })
        messageCount++
        previousMessageId = assistantMessageId
      }
    }
  }

  return { threads: threadCount, messages: messageCount }
}
