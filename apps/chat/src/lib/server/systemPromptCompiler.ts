import type { ChatbotCustomMode } from '@klicker-uzh/types'
import {
  normalizeChatbotCustomModeConfig,
  normalizeChatbotStandardModeConfig,
} from '@klicker-uzh/util'
import type { AnswerStyle, AnswerTone } from '@/src/lib/config/answerStyles'
import { DEFAULT_PROMPT } from '@/src/lib/config/prompts'
import { answerStyleInstructions } from '@/src/lib/server/answerStyleInstructions'
import { withCitationContract } from '@/src/lib/server/citationInstructions'
import { courseDataSection } from '@/src/lib/server/courseContextInstructions'
import { withCoursePolicyContract } from '@/src/lib/server/coursePolicyInstructions'
import { withInputContextContract } from '@/src/lib/server/inputContextInstructions'
import { withLanguageStyleContract } from '@/src/lib/server/languageInstructions'
import { withOutputFormatContract } from '@/src/lib/server/outputFormatInstructions'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

export type SystemPromptCompilationContext = {
  courseDisplayName: string
  toolNames: readonly string[]
  standardModeConfig?: unknown
  answerStyle?: AnswerStyle
  answerTone?: AnswerTone
  /**
   * The custom modes the calling surface should compile. Participant routes
   * pass the live column; owner preview passes the saved revision so it
   * reviews the exact configuration awaiting approval.
   */
  customModeConfig?: unknown
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

/**
 * The persona of an approved custom mode, which is stored outside
 * `systemPrompts`. Standard-mode keys stay platform-owned, so an entry that
 * reuses one never changes how a standard mode compiles.
 */
function customModePersonaText(
  customModeConfig: unknown,
  selectedMode: string
): string | null {
  return customMode(customModeConfig, selectedMode)?.personaText ?? null
}

function customMode(
  customModeConfig: unknown,
  selectedMode: string
): ChatbotCustomMode | null {
  if (isStandardModeKey(selectedMode)) return null

  const modes = normalizeChatbotCustomModeConfig(customModeConfig)?.modes ?? []
  return modes.find((candidate) => candidate.key === selectedMode) ?? null
}

function isStandardModeKey(mode: string): boolean {
  return Object.hasOwn(DEFAULT_PROMPT, mode)
}

function lecturerModePrompt(
  systemPrompts: unknown,
  selectedMode: string,
  context: SystemPromptCompilationContext
): string | null {
  return (
    customModePersonaText(context.customModeConfig, selectedMode) ??
    storedModePrompt(systemPrompts, selectedMode)
  )
}

/**
 * Whether the selected mode compiles as a lecturer-defined custom persona
 * rather than a platform mode contract.
 */
function compilesCustomPersona(
  systemPrompts: unknown,
  selectedMode: string,
  context: SystemPromptCompilationContext
): boolean {
  return (
    !DEFAULT_PROMPT[selectedMode]?.prompt &&
    lecturerModePrompt(systemPrompts, selectedMode, context) !== null
  )
}

function modeSections(
  systemPrompts: unknown,
  selectedMode: string,
  context: SystemPromptCompilationContext
): string[] {
  const platformMode = DEFAULT_PROMPT[selectedMode]?.prompt
  const lecturerPrompt = lecturerModePrompt(
    systemPrompts,
    selectedMode,
    context
  )
  const typedContext = standardModeContextSection(
    systemPrompts,
    context.standardModeConfig,
    selectedMode
  )

  if (platformMode) {
    return [
      ...(lecturerPrompt
        ? [
            promptSection(
              'Lecturer-provided guidance',
              renderPromptTemplate('lecturer-guidance', { lecturerPrompt })
            ),
          ]
        : []),
      ...(typedContext ? [typedContext] : []),
      promptSection(`Platform mode contract: ${selectedMode}`, platformMode),
    ]
  }

  return lecturerPrompt
    ? [
        promptSection(
          'Lecturer-defined custom persona',
          renderPromptTemplate('lecturer-custom-persona', {
            selectedModeJson: JSON.stringify(selectedMode),
            lecturerPrompt,
          })
        ),
      ]
    : []
}

function standardModeContextSection(
  systemPrompts: unknown,
  standardModeConfig: unknown,
  selectedMode: string
): string | null {
  if (
    selectedMode !== 'tutor' &&
    selectedMode !== 'explainer' &&
    selectedMode !== 'quizzer'
  ) {
    return null
  }

  const normalizedConfig = normalizeChatbotStandardModeConfig(
    standardModeConfig,
    systemPrompts
  )
  const personaContext =
    selectedMode === 'quizzer'
      ? { scopeNote: normalizedConfig.scopeNote }
      : {
          courseName: normalizedConfig.courseName,
          subjectDomain: normalizedConfig.subjectDomain,
          languageOfInstruction: normalizedConfig.languageOfInstruction,
          scopeNote: normalizedConfig.scopeNote,
        }
  if (Object.values(personaContext).every((value) => value === null))
    return null

  return promptSection(
    'Lecturer-provided standard-mode context',
    renderPromptTemplate('lecturer-standard-context', {
      personaContextJson: JSON.stringify(personaContext),
    })
  )
}

/**
 * Compiles the full system prompt in one stable authority order.
 *
 * Standard modes read course data, optional lecturer guidance, typed lecturer
 * context, and then their non-removable platform mode contract. Custom modes
 * replace those mode sections with their lecturer-defined persona. A
 * non-default student answer style or tone follows the mode sections. Every mode
 * then receives the same attachment, course, output, conditional citation,
 * and final language contracts; a custom persona receives their persona
 * variants, which keep the same protections.
 */
export function compileSystemPrompt(
  systemPrompts: unknown,
  selectedMode: string,
  context: SystemPromptCompilationContext
): string {
  const answerPreferences = answerStyleInstructions(
    context.answerStyle,
    context.answerTone
  )
  const base = [
    courseDataSection(context.courseDisplayName),
    ...modeSections(systemPrompts, selectedMode, context),
    ...(answerPreferences
      ? [promptSection('Student answer preferences', answerPreferences)]
      : []),
  ].join('\n\n')
  const customPersona = compilesCustomPersona(
    systemPrompts,
    selectedMode,
    context
  )
  const inputContext = withInputContextContract(base)
  const coursePolicy = withCoursePolicyContract(
    inputContext,
    context.toolNames,
    customPersona
  )
  const outputFormat = withOutputFormatContract(coursePolicy, customPersona)
  const citations = withCitationContract(outputFormat, context.toolNames)
  return withLanguageStyleContract(
    citations,
    customMode(context.customModeConfig, selectedMode)?.replyLanguage ?? null
  )
}
