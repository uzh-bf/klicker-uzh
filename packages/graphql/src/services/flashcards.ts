import { ContextWithUser } from '../lib/context'

export async function getFlashcardSets({}: {}, ctx: ContextWithUser) {
  if (!ctx.user.sub) {
    throw new Error('Unauthorized')
  }

  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      flashcardSets: {
        include: {
          flashcards: true,
          course: true,
        },
      },
    },
  })

  return user?.flashcardSets || []
}
