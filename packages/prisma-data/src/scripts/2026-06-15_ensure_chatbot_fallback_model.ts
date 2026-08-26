import { prisma } from '@klicker-uzh/prisma'

const DEFAULT_FALLBACK_MODEL_ID = 'gpt-5.6-luna'
const APPLY_FLAG = '--apply'

const fallbackModelId =
  process.env.CHAT_FALLBACK_MODEL_ID?.trim() || DEFAULT_FALLBACK_MODEL_ID
const apply = process.argv.includes(APPLY_FLAG)

async function run() {
  const [chatbots, zeroCreditCounts] = await Promise.all([
    prisma.chatbot.findMany({
      select: {
        id: true,
        name: true,
        modelSelection: true,
        allowedModelIds: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.chatUsageCredits.groupBy({
      by: ['chatbotId'],
      where: { current: { lte: 0 } },
      _count: { _all: true },
    }),
  ])

  const zeroCreditCountByChatbotId = new Map(
    zeroCreditCounts.map((entry) => [entry.chatbotId, entry._count._all])
  )
  const missingFallback = chatbots.filter(
    (chatbot) =>
      chatbot.allowedModelIds.length > 0 &&
      !chatbot.allowedModelIds.includes(fallbackModelId)
  )

  console.log(`Fallback model: ${fallbackModelId}`)
  console.log(`Chatbots scanned: ${chatbots.length}`)
  console.log(
    `Explicit allow-lists missing fallback: ${missingFallback.length}`
  )

  for (const chatbot of missingFallback) {
    const zeroCreditParticipants =
      zeroCreditCountByChatbotId.get(chatbot.id) ?? 0
    console.log(
      [
        `- ${chatbot.name}`,
        `id=${chatbot.id}`,
        `modelSelection=${chatbot.modelSelection}`,
        `zeroCreditParticipants=${zeroCreditParticipants}`,
        `allowedModelIds=${chatbot.allowedModelIds.join(',')}`,
      ].join(' ')
    )
  }

  if (!apply) {
    console.log(`Dry run only. Re-run with ${APPLY_FLAG} to update rows.`)
    return
  }

  for (const chatbot of missingFallback) {
    await prisma.chatbot.update({
      where: { id: chatbot.id },
      data: {
        allowedModelIds: [...chatbot.allowedModelIds, fallbackModelId],
      },
    })
  }

  console.log(`Updated ${missingFallback.length} chatbot allow-list(s).`)
}

try {
  await run()
} finally {
  await prisma.$disconnect()
}
