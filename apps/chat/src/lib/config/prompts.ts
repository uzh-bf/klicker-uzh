import { DEFAULT_TUTOR_PROMPT } from '@klicker-uzh/prisma'

import { DEFAULT_MODE_DESCRIPTIONS } from './mode-descriptions'

export const DEFAULT_PROMPT: Record<string, Record<string, string>> = {
  tutor: {
    // Authored seed text lives in @klicker-uzh/prisma (ADR 0043);
    // this module keeps the presentation-shaped Record contract.
    prompt: DEFAULT_TUTOR_PROMPT,
    description: DEFAULT_MODE_DESCRIPTIONS.tutor,
  },
}
