import type { CodeProfile } from '@klicker-uzh/code-runner'
import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
import {
  CODE_CARD_TOOL_NAME,
  MAX_STARTER_CODE_LENGTH,
} from '@/src/lib/code-runner/profiles'

export interface CodeCardToolResult {
  kind: 'code-card'
  profile: CodeProfile
  starterCode: string
}

const PROFILE_DESCRIPTIONS: Record<CodeProfile, string> = {
  'python-core': 'Python with its standard library',
  'r-base': 'base R',
}

/**
 * Adds the code card tool when the selected mode admits at least one browser
 * code profile. The card runs code only in the learner's browser; the model
 * learns that a card opened, never what the learner writes or runs.
 */
export function withCodeCardTool(
  tools: ToolSet,
  profiles: readonly CodeProfile[] | undefined
): ToolSet {
  if (!profiles || profiles.length === 0) return tools
  const [first, ...rest] = profiles
  return {
    ...tools,
    [CODE_CARD_TOOL_NAME]: tool({
      description:
        'Open an editable code playground card in the conversation, so the student can write and run a short program in their own browser. Use it when the student wants to try, run or experiment with code. Put a short, runnable starting point in starterCode.',
      inputSchema: z.object({
        profile: z
          .enum([first, ...rest])
          .describe(
            profiles
              .map((profile) => `${profile}: ${PROFILE_DESCRIPTIONS[profile]}`)
              .join('; ')
          ),
        starterCode: z
          .string()
          .max(MAX_STARTER_CODE_LENGTH)
          .describe('Initial code shown in the editor'),
      }),
      execute: ({ profile, starterCode }): CodeCardToolResult => ({
        kind: 'code-card',
        profile,
        starterCode,
      }),
      toModelOutput: () => ({
        type: 'text' as const,
        value:
          'A code playground card was shown to the student. You cannot see what they write or run unless they share it.',
      }),
    }),
  }
}
