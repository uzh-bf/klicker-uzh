import { Locale, UserLoginScope } from '@klicker-uzh/prisma/client'
import { TRPCError } from '@trpc/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { seedDemoQuestions } from '../../services/demoQuestions.js'
import { getPrisma } from '../context.js'
import { toUserProfile } from '../dto/user.js'
import { router } from '../init.js'
import {
  adminProcedure,
  userAccountOwnerProcedure,
  userFullAccessProcedure,
  userProcedure,
} from '../procedures.js'

type CookieResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown
}

const delegatedLoginSelect = {
  id: true,
  name: true,
  scope: true,
  lastLoginAt: true,
  user: {
    select: {
      id: true,
      shortname: true,
    },
  },
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

  checkShortnameAvailable: userProcedure
    .input(z.object({ shortname: z.string() }))
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const user = await prisma.user.findUnique({
        where: { shortname: input.shortname.trim() },
      })

      return !user || user.id === ctx.user.sub
    }),

  changeShortname: userFullAccessProcedure
    .input(z.object({ shortname: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const trimmedShortname = input.shortname.trim()

      if (trimmedShortname.length < 5 || trimmedShortname.length > 10) {
        return null
      }

      const existingUser = await prisma.user.findUnique({
        where: { shortname: trimmedShortname },
        select: { id: true },
      })

      if (existingUser && existingUser.id !== ctx.user.sub) {
        return await prisma.user.findUnique({
          where: { id: ctx.user.sub },
          select: { id: true, shortname: true },
        })
      }

      return await prisma.user.update({
        where: { id: ctx.user.sub },
        data: { shortname: trimmedShortname },
        select: { id: true, shortname: true },
      })
    }),

  changeUserLocale: userProcedure
    .input(z.object({ locale: z.nativeEnum(Locale) }))
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const user = await prisma.user.update({
        where: { id: ctx.user.sub },
        data: { locale: input.locale },
        select: { id: true, locale: true },
      })

      getCookieResponse(ctx.res).cookie('NEXT_LOCALE', input.locale, {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30,
        secure:
          process.env.NODE_ENV === 'production' &&
          process.env.COOKIE_DOMAIN !== '127.0.0.1',
        sameSite: 'lax',
      })

      return user
    }),

  changeEmailSettings: userFullAccessProcedure
    .input(z.object({ projectUpdates: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return await prisma.user.update({
        where: { id: ctx.user.sub },
        data: { sendProjectUpdates: input.projectUpdates },
        select: { id: true, sendProjectUpdates: true },
      })
    }),

  changeInitialSettings: userFullAccessProcedure
    .input(
      z.object({
        shortname: z.string(),
        locale: z.nativeEnum(Locale),
        sendUpdates: z.boolean(),
        seedDemoElements: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const trimmedShortname = input.shortname.trim()
      const existingUser = await prisma.user.findFirst({
        where: { shortname: trimmedShortname },
        select: { id: true },
      })

      if (existingUser && existingUser.id !== ctx.user.sub) {
        const user = await prisma.user.update({
          where: { id: ctx.user.sub },
          data: { locale: input.locale },
          select: {
            id: true,
            email: true,
            shortname: true,
            locale: true,
            firstLogin: true,
            catalystInstitutional: true,
            catalystIndividual: true,
            catalystTier: true,
          },
        })

        return {
          id: user.id,
          email: user.email,
          shortname: user.shortname,
          locale: user.locale,
          firstLogin: user.firstLogin,
          catalyst: user.catalystInstitutional || user.catalystIndividual,
          catalystTier: user.catalystTier,
        }
      }

      if (input.seedDemoElements) {
        await seedDemoQuestions({ prisma, userId: ctx.user.sub })
      }

      const user = await prisma.user.update({
        where: { id: ctx.user.sub },
        data: {
          shortname: trimmedShortname,
          locale: input.locale,
          sendProjectUpdates: input.sendUpdates,
          firstLogin: false,
        },
        select: {
          id: true,
          email: true,
          shortname: true,
          locale: true,
          firstLogin: true,
          catalystInstitutional: true,
          catalystIndividual: true,
          catalystTier: true,
        },
      })

      return {
        id: user.id,
        email: user.email,
        shortname: user.shortname,
        locale: user.locale,
        firstLogin: user.firstLogin,
        catalyst: user.catalystInstitutional || user.catalystIndividual,
        catalystTier: user.catalystTier,
      }
    }),

  delegatedAccess: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const userLogins = await prisma.userLogin.findMany({
      where: { user: { id: ctx.user.sub } },
      select: delegatedLoginSelect,
      orderBy: { scope: 'asc' },
    })

    return {
      userScope: ctx.user.scope,
      userLogins,
    }
  }),

  createUserLogin: userAccountOwnerProcedure
    .input(
      z.object({
        password: z.string(),
        name: z.string(),
        scope: z.nativeEnum(UserLoginScope),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const hashedPassword = await bcrypt.hash(input.password, 12)

      return await prisma.userLogin.create({
        data: {
          password: hashedPassword,
          name: input.name.trim(),
          // TODO: allow creation of other access levels once auth is handled granularly.
          scope: UserLoginScope.FULL_ACCESS,
          user: { connect: { id: ctx.user.sub } },
        },
        select: delegatedLoginSelect,
      })
    }),

  updateUserLogin: userAccountOwnerProcedure
    .input(z.object({ id: z.string(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const login = await prisma.userLogin.findUnique({
        where: { id: input.id, userId: ctx.user.sub },
      })

      if (!login) return null

      const hashedPassword = await bcrypt.hash(input.password, 12)
      return await prisma.userLogin.update({
        where: { id: input.id },
        data: { password: hashedPassword },
        select: delegatedLoginSelect,
      })
    }),

  deleteUserLogin: userAccountOwnerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const login = await prisma.userLogin.findUnique({
        where: { id: input.id, userId: ctx.user.sub },
      })

      if (!login) return null

      return await prisma.userLogin.delete({
        where: { id: input.id },
        select: { id: true },
      })
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
