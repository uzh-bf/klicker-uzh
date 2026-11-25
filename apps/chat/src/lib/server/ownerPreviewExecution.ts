import type { Chatbot, PrismaClient } from '@klicker-uzh/prisma/client'
import type { ResponseExampleSkillRole } from '@klicker-uzh/util/response-example-runtime'
import type { ToolSet } from 'ai'
import {
  type AnswerStyle,
  type AnswerTone,
  DEFAULT_ANSWER_STYLE,
  DEFAULT_ANSWER_TONE,
} from '@/src/lib/config/answerStyles'
import { getCustomModeTurnSettings } from '@/src/lib/server/effectiveChatModes'
import {
  formatMeetingClock,
  replyLanguageReminder,
} from '@/src/lib/server/languageInstructions'
import { resolveOwnerPreviewModeConfiguration } from '@/src/lib/server/previewAuthoringConfig'
import {
  createResponseExampleSearchTool,
  loadResponseExampleRuntimeSkill,
  RESPONSE_EXAMPLE_SEARCH_TOOL_NAME,
} from '@/src/lib/server/responseExampleRuntime'
import { compileSystemPrompt } from '@/src/lib/server/systemPromptCompiler'
import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'

type OwnerPreviewPromptChatbot = Pick<
  Chatbot,
  | 'id'
  | 'systemPrompts'
  | 'standardModeConfig'
  | 'customModeConfig'
  | 'draftConfig'
  | 'answerPreferencesEnabled'
> & { course: { displayName: string } }

/** Shared authoring configuration; example roles are selected only by server callers. */
export async function prepareOwnerPreviewContext({
  prisma,
  chatbot,
  tools: configuredTools,
  selectedMode,
  answerStyle = DEFAULT_ANSWER_STYLE,
  answerTone = DEFAULT_ANSWER_TONE,
  responseExampleRole,
}: {
  prisma: PrismaClient
  chatbot: OwnerPreviewPromptChatbot
  tools: ToolSet
  selectedMode: string
  answerStyle?: AnswerStyle
  answerTone?: AnswerTone
  responseExampleRole: ResponseExampleSkillRole
}) {
  let tools = configuredTools
  let responseExampleSummary = ''
  try {
    const responseExampleSkill = await loadResponseExampleRuntimeSkill({
      prisma,
      chatbotId: chatbot.id,
      chatMode: selectedMode,
      role: responseExampleRole,
    })
    if (Object.hasOwn(tools, RESPONSE_EXAMPLE_SEARCH_TOOL_NAME)) {
      console.warn(
        'Response-example skill name conflicts with an existing tool; continuing without response examples',
        { chatbotId: chatbot.id }
      )
    } else {
      tools = {
        ...tools,
        [RESPONSE_EXAMPLE_SEARCH_TOOL_NAME]:
          createResponseExampleSearchTool(responseExampleSkill),
      }
      responseExampleSummary = responseExampleSkill.summary
    }
  } catch (error) {
    console.warn(
      'Response-example skill loading failed; continuing without response examples',
      {
        chatbotId: chatbot.id,
        errorType: error instanceof Error ? error.name : typeof error,
      }
    )
  }

  const toolNames = Object.keys(tools)
  const docQueryToolName = toolNames.find(isDocQueryToolName)
  const quizzerDocQueryToolName =
    selectedMode === 'quizzer' ? docQueryToolName : undefined

  if (selectedMode === 'quizzer' && !quizzerDocQueryToolName) {
    return { unavailable: true as const }
  }

  const draftConfig = chatbot.draftConfig
  const savedAnswerPreferencesEnabled =
    draftConfig &&
    typeof draftConfig === 'object' &&
    !Array.isArray(draftConfig)
      ? (draftConfig as Record<string, unknown>).answerPreferencesEnabled
      : undefined
  const answerPreferencesEnabled =
    typeof savedAnswerPreferencesEnabled === 'boolean'
      ? savedAnswerPreferencesEnabled
      : chatbot.answerPreferencesEnabled
  const systemPrompt = compileSystemPrompt(
    chatbot.systemPrompts,
    selectedMode,
    {
      courseDisplayName: chatbot.course.displayName,
      toolNames,
      answerStyle: answerPreferencesEnabled
        ? answerStyle
        : DEFAULT_ANSWER_STYLE,
      answerTone: answerPreferencesEnabled ? answerTone : DEFAULT_ANSWER_TONE,
      standardModeConfig: chatbot.standardModeConfig,
      // Owner preview is an authoring surface, so it compiles the saved
      // revision's custom modes rather than the currently approved set.
      customModeConfig: resolveOwnerPreviewModeConfiguration(chatbot),
    }
  )
  const effectiveSystemPrompt = responseExampleSummary
    ? `${systemPrompt}\n\n${responseExampleSummary}`
    : systemPrompt
  // Preview persists no thread and its messages carry no timestamps, so a
  // meeting clock reports zero elapsed minutes here.
  const turnSettings = getCustomModeTurnSettings(
    resolveOwnerPreviewModeConfiguration(chatbot),
    selectedMode
  )
  const languageReminder = replyLanguageReminder(
    turnSettings.replyLanguage ?? null,
    formatMeetingClock(turnSettings.meetingClock ?? null, null, new Date())
  )

  return {
    unavailable: false as const,
    tools,
    effectiveSystemPrompt,
    turnSettings,
    languageReminder,
    docQueryToolName,
    quizzerDocQueryToolName,
  }
}
