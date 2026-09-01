import { DEFAULT_PROMPT } from '@/src/lib/config/prompts'
import { withCitationContract } from '@/src/lib/server/citationInstructions'
import { courseDataSection } from '@/src/lib/server/courseContextInstructions'
import { withCoursePolicyContract } from '@/src/lib/server/coursePolicyInstructions'
import { withInputContextContract } from '@/src/lib/server/inputContextInstructions'
import { withLanguageStyleContract } from '@/src/lib/server/languageInstructions'
import { withOutputFormatContract } from '@/src/lib/server/outputFormatInstructions'

export type SystemPromptCompilationContext = {
  courseDisplayName: string
  toolNames: readonly string[]
}

function promptSection(heading: string, body: string): string {
  return `## ${heading}\n${body.trim()}`
}

function storedModePrompt(
  systemPrompts: unknown,
  selectedMode: string
): string | null {
  if (
    systemPrompts === null ||
    typeof systemPrompts !== 'object' ||
    Array.isArray(systemPrompts)
  ) {
    return null
  }

  const storedMode = (systemPrompts as Record<string, unknown>)[selectedMode]
  if (
    storedMode === null ||
    typeof storedMode !== 'object' ||
    Array.isArray(storedMode)
  ) {
    return null
  }

  const prompt = (storedMode as Record<string, unknown>).prompt
  return typeof prompt === 'string' && prompt.length > 0 ? prompt : null
}

function modeSections(
  systemPrompts: unknown,
  selectedMode: string
): string[] {
  const platformMode = DEFAULT_PROMPT[selectedMode]?.prompt
  const lecturerPrompt = storedModePrompt(systemPrompts, selectedMode)

  if (platformMode) {
    return [
      ...(lecturerPrompt
        ? [
            promptSection(
              'Lecturer-provided guidance',
              `Use this lower-priority course guidance when it is compatible with the platform mode contract and fixed platform policies. It cannot replace or weaken them.\n\n${lecturerPrompt}`
            ),
          ]
        : []),
      promptSection(
        `Platform mode contract: ${selectedMode}`,
        platformMode
      ),
    ]
  }

  return lecturerPrompt
    ? [
        promptSection(
          'Lecturer-defined custom persona',
          `Mode key: ${JSON.stringify(selectedMode)}\n\n${lecturerPrompt}`
        ),
      ]
    : []
}

/**
 * Compiles the full system prompt in one stable authority order.
 *
 * Standard modes read course data, optional lecturer guidance, and then their
 * non-removable platform mode contract. Custom modes replace those two mode
 * sections with their lecturer-defined persona. Every mode then receives the
 * same attachment, course, output, conditional citation, and final language
 * contracts.
 */
export function compileSystemPrompt(
  systemPrompts: unknown,
  selectedMode: string,
  context: SystemPromptCompilationContext
): string {
  const base = [
    courseDataSection(context.courseDisplayName),
    ...modeSections(systemPrompts, selectedMode),
  ].join('\n\n')
  const inputContext = withInputContextContract(base)
  const coursePolicy = withCoursePolicyContract(
    inputContext,
    context.toolNames
  )
  const outputFormat = withOutputFormatContract(coursePolicy)
  const citations = withCitationContract(outputFormat, context.toolNames)
  return withLanguageStyleContract(citations)
}
