import { UserRole } from '@klicker-uzh/prisma'
import builder from '../builder'

export const Query = builder.queryType({
  fields: (t) => ({
    self: t.prismaField({
      nullable: true,
      type: 'Participant',
      authScopes: {
        role: UserRole.PARTICIPANT,
      },
      resolve(query, _, _args, ctx) {
        if (!ctx.user?.sub) return null
        return ctx.prisma.participant.findUnique({
          ...query,
          where: { id: ctx.user.sub },
        })
      },
    }),
  }),
})
