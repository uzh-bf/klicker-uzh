import type { RouterOutputs } from '../../lib/trpc'

export type UserGroup = NonNullable<
  RouterOutputs['sharing']['userGroups']['userGroups']
>[number]
