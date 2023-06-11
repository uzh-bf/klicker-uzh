import { FlashcardSetStatus } from '@klicker-uzh/prisma'
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
          _count: {
            select: {
              flashcards: true,
            },
          },
          course: true,
        },
      },
    },
  })

  const flashcards =
    user?.flashcardSets.map((set) => {
      return { ...set, numOfFlashcards: set._count?.flashcards }
    }) || []

  return flashcards
}

interface ChangePublishedStateArgs {
  id: number
  published: boolean
}

export async function changePublishedState(
  { id, published }: ChangePublishedStateArgs,
  ctx: ContextWithUser
) {
  if (!ctx.user.sub) {
    throw new Error('Unauthorized')
  }

  const flashcardSet = await ctx.prisma.flashcardSet.update({
    where: { id },
    data: {
      status: published
        ? FlashcardSetStatus.PUBLISHED
        : FlashcardSetStatus.DRAFT,
    },
  })

  return flashcardSet
}
