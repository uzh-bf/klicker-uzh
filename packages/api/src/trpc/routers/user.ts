import { getPrisma } from '../context.js'
import { toUserProfile } from '../dto/user.js'
import { router } from '../init.js'
import { userProcedure } from '../procedures.js'

export const userRouter = router({
  profile: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
    })
    const numChatbots = user
      ? await prisma.chatbot.count({ where: { ownerId: user.id } })
      : 0

    return toUserProfile(user, { numChatbots })
  }),
})
