import type { RouterOutputs } from '../../../lib/trpc'

export type UserTagData = RouterOutputs['element']['tags']['tags'][number]
