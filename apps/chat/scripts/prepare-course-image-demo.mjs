// Only the marked disposable database and the known seeded Benibot owner.
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import { LOCAL_CHATBOT_ID } from './local-mcp-auth.mjs'

try {
  await requireDisposableDatabase(prisma)
  const bot = await prisma.chatbot.findUniqueOrThrow({
    where: { id: LOCAL_CHATBOT_ID },
    select: {
      name: true,
      ownerId: true,
      owner: { select: { aiFeaturesEnabled: true } },
    },
  })
  if (bot.name !== 'Benibot') throw new Error('Synthetic chatbot mismatch')
  if (process.env.DRY_RUN !== 'false') {
    console.log(
      'Dry run: enable AI access for the synthetic Benibot owner only.'
    )
  } else {
    await prisma.user.update({
      where: { id: bot.ownerId },
      data: { aiFeaturesEnabled: true },
    })
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: bot.ownerId },
      select: { aiFeaturesEnabled: true },
    })
    if (!after.aiFeaturesEnabled) throw new Error('Fixture update failed')
    console.log('Synthetic Benibot owner AI access verified.')
  }
} finally {
  await prisma.$disconnect()
}
