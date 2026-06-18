import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { getPrisma } from '../context.js'
import { toUserProfile } from '../dto/user.js'
import { router } from '../init.js'
import { adminProcedure, userProcedure } from '../procedures.js'

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

async function sendTeamsNotification({
  scope,
  text,
}: {
  scope: string
  text: string
}) {
  if (!process.env.TEAMS_WEBHOOK_URL) return null

  try {
    return await fetch(process.env.TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        '@context': 'https://schema.org/extensions',
        '@type': 'MessageCard',
        themeColor: '0076D7',
        title: scope,
        text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
      }),
    })
  } catch (error) {
    console.error('Failed to send Teams notification:', error)
    return null
  }
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

  privatePreviewUsers: adminProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const users = await prisma.user.findMany({
      where: { privatePreview: true },
      select: { shortname: true, email: true },
    })

    return users.map((user) => ({
      shortname: user.shortname,
      email: user.email,
    }))
  }),

  grantPrivatePreviewAccess: adminProcedure
    .input(z.object({ email: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const newUser = await prisma.user.findUnique({
        where: { email: input.email },
      })

      if (!newUser) return 1
      if (newUser.privatePreview) return 2

      await prisma.user.update({
        where: { id: newUser.id },
        data: { privatePreview: true },
      })
      await sendTeamsNotification({
        scope: 'trpc/grantPrivatePreviewAccess',
        text: `User ${newUser.shortname} (${newUser.email}) granted private preview access`,
      })

      return 0
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
