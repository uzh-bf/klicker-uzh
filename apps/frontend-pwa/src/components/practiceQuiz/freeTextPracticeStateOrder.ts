import type { FreeTextPracticeStateDataFragment } from '@klicker-uzh/graphql/dist/ops'

type VersionedFreeTextPracticeState = Pick<
  FreeTextPracticeStateDataFragment,
  'instanceId' | 'cycleOrdinal' | 'stateVersion'
>

export function preferLatestFreeTextPracticeState<
  State extends VersionedFreeTextPracticeState,
>(instanceId: number, current: State | null, incoming: State | null) {
  if (!incoming) return current
  if (incoming.instanceId !== instanceId) return current
  if (!current || current.instanceId !== instanceId) return incoming
  if (incoming.cycleOrdinal !== current.cycleOrdinal) {
    return incoming.cycleOrdinal > current.cycleOrdinal ? incoming : current
  }

  return incoming.stateVersion > current.stateVersion ? incoming : current
}
