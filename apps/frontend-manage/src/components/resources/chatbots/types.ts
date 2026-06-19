import type { RouterOutputs } from '../../../lib/trpc'

type ChatbotsInfo = RouterOutputs['resources']['chatbotsInfo']['chatbotsInfo']

export type Chatbot = ChatbotsInfo[number]

export type ChatModelCapability =
  RouterOutputs['resources']['chatModelRegistry']['chatModelRegistry'][number]

export const CreditResetPeriod = {
  Daily: 'DAILY',
  Weekly: 'WEEKLY',
  Biweekly: 'BIWEEKLY',
  Monthly: 'MONTHLY',
  None: 'NONE',
} as const
