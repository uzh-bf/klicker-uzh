import { TRPCError } from '@trpc/server'
import { getPrisma } from '../context.js'
import { toUserProfile } from '../dto/user.js'
import { router } from '../init.js'
import { userProcedure } from '../procedures.js'

type CookieResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown
}

function getCookieResponse(res: unknown): CookieResponse {
  if (!res || typeof res !== 'object' || !('cookie' in res)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Cookie response unavailable',
    })
  }

  return res as CookieResponse
}

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

  logout: userProcedure.mutation(async ({ ctx }) => {
    getCookieResponse(ctx.res).cookie(
      'next-auth.session-token',
      'logoutString',
      {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        httpOnly: true,
        maxAge: 0,
        secure:
          process.env.NODE_ENV === 'production' &&
          process.env.COOKIE_DOMAIN !== '127.0.0.1',
        sameSite: 'lax',
      }
    )

    return ctx.user.sub
  }),
})
