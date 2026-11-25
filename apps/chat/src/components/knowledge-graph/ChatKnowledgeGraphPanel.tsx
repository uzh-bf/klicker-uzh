'use client'

import { useAui } from '@assistant-ui/react'
import type { KnowledgeGraphAskSelection } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphView'
import { useTranslations } from 'next-intl'
import { resolveSelectedMode } from '@/src/lib/config/modes'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import {
  useChatWorkspace,
  WORKSPACE_SPLIT_QUERY,
} from '../workspace/chat-workspace-context'
import { ChatKnowledgeGraphWorkspace } from './ChatKnowledgeGraphWorkspace'

const QUIZ_MODE = 'quizzer'

/** The graph's heading in the shared workspace panel toolbar. */
export function ChatKnowledgeGraphPanelTitle() {
  const t = useTranslations('chat.graphPanel')
  return (
    <>
      <h2 className="min-w-0 truncate text-sm font-medium">{t('title')}</h2>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground focus-visible:ring-ring shrink-0 cursor-help rounded-full border px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2"
            data-cy="knowledge-graph-ai-generated"
          >
            {t('aiGenerated')}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {t('aiGeneratedHint')}
        </TooltipContent>
      </Tooltip>
    </>
  )
}

/**
 * The knowledge graph inside the shared workspace panel. Its ask and quiz
 * actions draft a question into the composer, which stays usable beside the
 * docked or expanded graph.
 */
export function ChatKnowledgeGraphPanelContent() {
  const t = useTranslations('chat.graphPanel')
  const aui = useAui()
  const workspace = useChatWorkspace()
  const modeOptions = useSettingsStore((state) => state.modeOptions)
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const setSelectedMode = useSettingsStore((state) => state.setSelectedMode)
  const activeMode = resolveSelectedMode(modeOptions, selectedMode)
  const canQuiz = QUIZ_MODE in modeOptions

  // Each mode gets the wording it is built to answer, so the drafted
  // question starts the kind of work that mode supports.
  function askPrompt(selection: KnowledgeGraphAskSelection) {
    if (selection.kind === 'node') {
      const values = { topic: selection.label }
      if (activeMode === 'tutor') return t('nodePromptTutor', values)
      if (activeMode === 'explainer') return t('nodePromptExplainer', values)
      return t('nodePrompt', values)
    }
    const values = {
      source: selection.source,
      target: selection.target,
      relationship: selection.label,
    }
    if (activeMode === 'tutor') return t('edgePromptTutor', values)
    if (activeMode === 'explainer') return t('edgePromptExplainer', values)
    return t('edgePrompt', values)
  }

  function quiz(selection: KnowledgeGraphAskSelection) {
    setSelectedMode(QUIZ_MODE)
    draft(
      selection.kind === 'node'
        ? t('quizNodePrompt', { topic: selection.label })
        : t('quizEdgePrompt', {
            source: selection.source,
            target: selection.target,
            relationship: selection.label,
          })
    )
  }

  function draft(prompt: string) {
    const text = aui.composer.getState().text
    aui.composer.setText(text.trim() ? `${text}\n\n${prompt}` : prompt)
    // Below the split breakpoint the graph covers the conversation, so the
    // composer only becomes reachable once the panel closes.
    if (!window.matchMedia(WORKSPACE_SPLIT_QUERY).matches) {
      workspace.close({ focusComposer: true })
      return
    }
    if (workspace.size === 'fullscreen') {
      workspace.exitFullscreen({ focusComposer: true })
      return
    }
    // A docked or expanded action has no state transition to wait for.
    document
      .querySelector<HTMLTextAreaElement>('[data-cy="chat-composer-input"]')
      ?.focus()
  }

  return (
    <ChatKnowledgeGraphWorkspace
      chatbotId={workspace.chatbotId}
      onAsk={(selection) => draft(askPrompt(selection))}
      onQuiz={canQuiz ? quiz : undefined}
      focusRequest={workspace.graph.focusRequest}
    />
  )
}
