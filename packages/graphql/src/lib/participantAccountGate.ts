import { UserRole } from '@klicker-uzh/prisma/client'
import {
  isParticipantDataUseComplete,
  participantAccountDataUseSelect,
} from '@klicker-uzh/util'
import {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core'
import SchemaBuilder from '@pothos/core'
import { GraphQLError, type GraphQLFieldResolver } from 'graphql'
import type { Context } from './context.js'

declare global {
  export namespace PothosSchemaTypes {
    interface Plugins<Types extends SchemaTypes> {
      participantAccountGate: PothosParticipantAccountGatePlugin
    }
    interface SchemaBuilderOptions<Types extends SchemaTypes> {
      participantAccountGate: Record<string, never>
    }
    interface V3SchemaBuilderOptions<Types extends SchemaTypes> {
      participantAccountGate: never
    }
  }
}

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

function isSupportField(fieldConfig: PothosOutputFieldConfig<SchemaTypes>) {
  return supportFields.has(`${fieldConfig.parentType}.${fieldConfig.name}`)
}

// Root fields carry the account boundary; nested object resolvers reuse the
// parent field's authorization and must not trigger a second completion check.
function isRootField(fieldConfig: PothosOutputFieldConfig<SchemaTypes>) {
  return ['Query', 'Mutation', 'Subscription'].includes(fieldConfig.parentType)
}

/**
 * The data-use gate must register after the scope-auth plugin so a field's
 * own authorization decision always precedes the completion check; an
 * unauthorized caller keeps receiving the field's authorization error
 * instead of a consent error from an outer wrapper.
 */
export class PothosParticipantAccountGatePlugin extends BasePlugin<SchemaTypes> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, SchemaTypes['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<SchemaTypes>
  ): GraphQLFieldResolver<unknown, SchemaTypes['Context'], object> {
    if (!isRootField(fieldConfig) || isSupportField(fieldConfig))
      return resolver
    return async (source, args, ctx, info) => {
      await requireParticipantAccountCompletion(ctx as Context)
      return resolver(source, args, ctx, info)
    }
  }

  override wrapSubscribe(
    subscriber: GraphQLFieldResolver<unknown, SchemaTypes['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<SchemaTypes>
  ): GraphQLFieldResolver<unknown, SchemaTypes['Context'], object> {
    if (!isRootField(fieldConfig) || isSupportField(fieldConfig))
      return subscriber
    return async (source, args, ctx, info) => {
      await requireParticipantAccountCompletion(ctx as Context)
      return subscriber(source, args, ctx, info)
    }
  }
}

export const participantAccountGatePluginName = 'participantAccountGate'

// Test files re-evaluate this module while the externalized Pothos builder
// keeps its static plugin registry, so registration must be idempotent.
try {
  SchemaBuilder.registerPlugin(
    participantAccountGatePluginName,
    PothosParticipantAccountGatePlugin
  )
} catch {
  // Already registered by an earlier evaluation of this module.
}
