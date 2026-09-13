import { UserRole } from '@klicker-uzh/prisma/client'
import {
  isParticipantDataUseComplete,
  participantAccountDataUseSelect,
} from '@klicker-uzh/util'
import { defaultFieldResolver, GraphQLError, type GraphQLSchema } from 'graphql'
import type { Context } from './context.js'

const supportFields = new Set([
  'Query.self',
  'Query.selfAccountDataUse',
  'Mutation.completeParticipantDataUse',
  'Mutation.loginParticipant',
  'Mutation.loginParticipantMagicLink',
  'Mutation.loginParticipantWithLti',
  'Mutation.activateParticipantAccount',
  'Mutation.sendMagicLink',
  'Mutation.logoutParticipant',
  'Mutation.deleteParticipantAccount',
  'Mutation.changeParticipantLocale',
])

export async function requireParticipantAccountCompletion(ctx: Context) {
  if (ctx.user?.role !== UserRole.PARTICIPANT) return
  const participant = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    select: participantAccountDataUseSelect,
  })
  if (!isParticipantDataUseComplete(participant)) {
    throw new GraphQLError('Account data-use completion required', {
      extensions: { code: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED' },
    })
  }
}

export function applyParticipantAccountGate(schema: GraphQLSchema) {
  for (const root of [
    schema.getQueryType(),
    schema.getMutationType(),
    schema.getSubscriptionType(),
  ]) {
    if (!root) continue
    for (const field of Object.values(root.getFields())) {
      if (supportFields.has(`${root.name}.${field.name}`)) continue
      const resolve = field.resolve ?? defaultFieldResolver
      field.resolve = async (source, args, ctx: Context, info) => {
        await requireParticipantAccountCompletion(ctx)
        return resolve(source, args, ctx, info)
      }
      const subscribe = field.subscribe
      if (subscribe) {
        field.subscribe = async (source, args, ctx: Context, info) => {
          await requireParticipantAccountCompletion(ctx)
          return subscribe(source, args, ctx, info)
        }
      }
    }
  }
}
