'use client'

import { AssistantRuntimeProvider } from '@assistant-ui/react'
import {
  AssistantChatTransport,
  useChatRuntime,
} from '@assistant-ui/react-ai-sdk'
import { Select } from '@uzh-bf/design-system'
import { FlaskConicalIcon, PlusIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ModelOption } from '@/src/lib/config/models'
import { resolveSelectedMode } from '@/src/lib/config/modes'
import {
  formatReasoningEffort,
  type ReasoningEffort,
} from '@/src/lib/config/reasoning'
import { getDefaultReasoningEffort } from '@/src/lib/ownerPreviewPolicy'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { ChatUiProvider } from './chat-ui-context'
import { ModeOptionsProvider } from './mode-options-context'
import { Thread } from './thread'

type OwnerPreviewAssistantProps = {
  chatbot: {
    avatar?: string
    id: string
    name: string
  }
  initialModeOptions: Record<string, string>
  manageUrl: string
  modelSelection: boolean
  modelOptions: ModelOption[]
  selectedModelId: string | null
  selectedReasoningEffort: ReasoningEffort | null
}

type PreviewConversation = {
  id: string
  number: number
  modelId: string | null
  reasoningEffort: ReasoningEffort | null
}

function createPreviewConversation(
  number: number,
  modelId: string | null,
  reasoningEffort: ReasoningEffort | null
): PreviewConversation {
  return {
    id: `owner-preview-${number}`,
    number,
    modelId,
    reasoningEffort,
  }
}

export function OwnerPreviewAssistant({
  chatbot,
  initialModeOptions,
  manageUrl,
  modelSelection,
  modelOptions,
  selectedModelId,
  selectedReasoningEffort,
}: OwnerPreviewAssistantProps) {
  const t = useTranslations()
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const setSelectedMode = useSettingsStore((state) => state.setSelectedMode)
  const effectiveMode = resolveSelectedMode(initialModeOptions, selectedMode)
  const nextConversationNumber = useRef(2)
  const [conversations, setConversations] = useState<PreviewConversation[]>(
    () => [
      createPreviewConversation(1, selectedModelId, selectedReasoningEffort),
    ]
  )
  const [activeConversationId, setActiveConversationId] =
    useState('owner-preview-1')

  useEffect(() => {
    if (effectiveMode && effectiveMode !== selectedMode) {
      setSelectedMode(effectiveMode)
    }
  }, [effectiveMode, selectedMode, setSelectedMode])

  const activeConversation =
    conversations.find(({ id }) => id === activeConversationId) ??
    conversations[0]
  const selectedModelOption = modelOptions.find(
    ({ id }) => id === activeConversation?.modelId
  )
  const availableReasoningEfforts =
    selectedModelOption?.supportsReasoning === true
      ? selectedModelOption.allowedReasoningEfforts
      : []

  const updateActiveConversation = (
    update: Partial<Pick<PreviewConversation, 'modelId' | 'reasoningEffort'>>
  ) => {
    if (!activeConversation) return
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id
          ? { ...conversation, ...update }
          : conversation
      )
    )
  }

  const handleModelChange = (modelId: string) => {
    const option = modelOptions.find((model) => model.id === modelId)
    const currentEffort = activeConversation?.reasoningEffort
    const reasoningEffort =
      option?.supportsReasoning === true
        ? option.allowedReasoningEfforts.includes(currentEffort ?? '')
          ? currentEffort
          : getDefaultReasoningEffort(option.allowedReasoningEfforts)
        : null
    updateActiveConversation({ modelId, reasoningEffort })
  }

  const handleReasoningEffortChange = (reasoningEffort: string) => {
    updateActiveConversation({
      reasoningEffort: reasoningEffort as ReasoningEffort,
    })
  }

  const handleNewConversation = () => {
    const number = nextConversationNumber.current++
    const conversation = createPreviewConversation(
      number,
      selectedModelId,
      selectedReasoningEffort
    )
    setConversations((current) => [...current, conversation])
    setActiveConversationId(conversation.id)
  }

  const fixedModel = selectedModelOption
  const modelPolicyText = fixedModel
    ? fixedModel.name
    : (activeConversation?.modelId ?? t('chat.ownerPreview.modelUnavailable'))
  const reasoningPolicyText =
    activeConversation?.reasoningEffort &&
    activeConversation.reasoningEffort !== 'none'
      ? formatReasoningEffort(t, activeConversation.reasoningEffort)
      : null

  return (
    <ChatUiProvider variant="owner-preview">
      <div className="bg-background flex h-dvh w-full flex-col overflow-hidden">
        <header className="border-border bg-card shrink-0 border-b px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold">
                  {chatbot.name}
                </h1>
                <span className="border-primary/20 bg-primary/5 text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold">
                  <FlaskConicalIcon className="size-3.5" />
                  {t('chat.ownerPreview.badge')}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('chat.ownerPreview.description')}
              </p>
            </div>
            <a
              href={manageUrl}
              data-cy="owner-preview-back-to-manage"
              className="border-border bg-background hover:bg-accent focus-visible:ring-ring inline-flex min-h-10 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              {t('chat.ownerPreview.backToManage')}
            </a>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside
            aria-label={t('chat.ownerPreview.sidebarLabel')}
            className="border-border bg-card flex h-[min(22rem,38vh)] max-h-[min(22rem,38vh)] w-full shrink-0 flex-col border-b md:h-auto md:max-h-none md:w-72 md:border-b-0 md:border-r"
          >
            <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-3">
              <h2 className="text-sm font-semibold">
                {t('chat.ownerPreview.sidebarTitle')}
              </h2>
              <button
                type="button"
                data-cy="owner-preview-new-conversation"
                onClick={handleNewConversation}
                className="border-border bg-background hover:bg-accent focus-visible:ring-ring inline-flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <PlusIcon aria-hidden="true" className="size-3.5" />
                {t('chat.ownerPreview.newTestConversation')}
              </button>
            </div>

            <nav
              aria-label={t('chat.ownerPreview.conversationListLabel')}
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              <ul className="flex flex-col gap-1">
                {conversations.map((conversation) => {
                  const active = conversation.id === activeConversation?.id
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        data-cy={`owner-preview-conversation-${conversation.number}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setActiveConversationId(conversation.id)}
                        className="hover:bg-accent focus-visible:ring-ring flex min-h-11 w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium"
                      >
                        {t('chat.ownerPreview.testConversation', {
                          number: conversation.number,
                        })}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="border-border max-h-[10rem] space-y-3 overflow-y-auto border-t px-3 py-3 text-xs md:max-h-[45%]">
              <section aria-labelledby="owner-preview-policy-heading">
                <h3
                  id="owner-preview-policy-heading"
                  className="text-sm font-semibold"
                >
                  {t('chat.ownerPreview.savedSettings')}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {t('chat.ownerPreview.savedSettingsNotice')}
                </p>
              </section>

              {modelSelection ? (
                <section
                  aria-labelledby="owner-preview-temporary-settings-heading"
                  className="space-y-2"
                >
                  <h3
                    id="owner-preview-temporary-settings-heading"
                    className="text-sm font-semibold"
                  >
                    {t('chat.ownerPreview.temporarySettings')}
                  </h3>
                  {modelOptions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label
                          htmlFor="owner-preview-model-select"
                          className="font-medium"
                        >
                          {t('chat.settingsPanel.aiModelLabel')}
                        </label>
                        <Select
                          id="owner-preview-model-select"
                          data={{ cy: 'owner-preview-model-select' }}
                          items={modelOptions.map((option) => ({
                            value: option.id,
                            label: option.name,
                          }))}
                          onChange={handleModelChange}
                          value={activeConversation?.modelId ?? ''}
                        />
                      </div>
                      {availableReasoningEfforts.length > 0 ? (
                        <div className="space-y-1">
                          <label
                            htmlFor="owner-preview-reasoning-select"
                            className="font-medium"
                          >
                            {t('chat.settingsPanel.reasoningEffortLabel')}
                          </label>
                          <Select
                            id="owner-preview-reasoning-select"
                            data={{ cy: 'owner-preview-reasoning-select' }}
                            items={availableReasoningEfforts.map((effort) => ({
                              value: effort,
                              label: formatReasoningEffort(t, effort),
                            }))}
                            onChange={handleReasoningEffortChange}
                            value={activeConversation?.reasoningEffort ?? ''}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p role="status" className="text-muted-foreground">
                      {t('chat.ownerPreview.modelUnavailable')}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {t('chat.ownerPreview.temporarySettingsNotice')}
                  </p>
                </section>
              ) : (
                <section
                  aria-labelledby="owner-preview-fixed-policy-heading"
                  className="space-y-1"
                >
                  <h3
                    id="owner-preview-fixed-policy-heading"
                    className="text-sm font-semibold"
                  >
                    {t('chat.ownerPreview.fixedPolicy')}
                  </h3>
                  <p data-cy="owner-preview-fixed-policy">
                    {modelPolicyText}
                    {reasoningPolicyText ? ` · ${reasoningPolicyText}` : ''}
                  </p>
                  <p className="text-muted-foreground">
                    {t('chat.ownerPreview.fixedPolicyNotice')}
                  </p>
                </section>
              )}

              <section
                aria-labelledby="owner-preview-tool-limits-heading"
                className="space-y-1"
              >
                <h3
                  id="owner-preview-tool-limits-heading"
                  className="text-sm font-semibold"
                >
                  {t('chat.ownerPreview.toolLimitsTitle')}
                </h3>
                <p className="text-muted-foreground">
                  {t('chat.ownerPreview.toolLimitsNotice')}
                </p>
              </section>
            </div>
          </aside>

          <main
            id="main-content"
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            {conversations.map((conversation) => (
              <OwnerPreviewConversation
                key={conversation.id}
                active={conversation.id === activeConversation?.id}
                chatbot={chatbot}
                conversation={conversation}
                effectiveMode={effectiveMode}
                initialModeOptions={initialModeOptions}
              />
            ))}
          </main>
        </div>
      </div>
    </ChatUiProvider>
  )
}

function OwnerPreviewConversation({
  active,
  chatbot,
  conversation,
  effectiveMode,
  initialModeOptions,
}: {
  active: boolean
  chatbot: OwnerPreviewAssistantProps['chatbot']
  conversation: PreviewConversation
  effectiveMode: string
  initialModeOptions: Record<string, string>
}) {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: `/api/manage/chatbots/${encodeURIComponent(chatbot.id)}/preview/chat`,
        body: {
          selectedMode: effectiveMode || 'tutor',
          ...(conversation.modelId
            ? { selectedModel: conversation.modelId }
            : {}),
          reasoningEffort: conversation.reasoningEffort,
        },
      }),
    [
      chatbot.id,
      conversation.modelId,
      conversation.reasoningEffort,
      effectiveMode,
    ]
  )
  const runtime = useChatRuntime({ transport })

  return (
    <div
      hidden={!active}
      aria-hidden={!active}
      className={active ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
    >
      <ModeOptionsProvider modeOptions={initialModeOptions}>
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread
            chatbotAvatar={chatbot.avatar ?? ''}
            chatbotName={chatbot.name}
            initialModeOptions={initialModeOptions}
            maxImageAttachments={0}
          />
        </AssistantRuntimeProvider>
      </ModeOptionsProvider>
    </div>
  )
}
