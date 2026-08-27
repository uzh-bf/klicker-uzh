'use client'

import { AssistantRuntimeProvider } from '@assistant-ui/react'
import {
  AssistantChatTransport,
  useChatRuntime,
} from '@assistant-ui/react-ai-sdk'
import { FlaskConicalIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo } from 'react'
import { resolveSelectedMode } from '@/src/lib/config/modes'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { ChatUiProvider } from './chat-ui-context'
import { Thread } from './thread'

type OwnerPreviewAssistantProps = {
  chatbot: {
    avatar?: string
    id: string
    name: string
  }
  initialModeOptions: Record<string, string>
  initialModeOptionsAreFallback: boolean
  manageUrl: string
}

export function OwnerPreviewAssistant(props: OwnerPreviewAssistantProps) {
  return (
    <ChatUiProvider variant="owner-preview">
      <OwnerPreviewAssistantInner {...props} />
    </ChatUiProvider>
  )
}

function OwnerPreviewAssistantInner({
  chatbot,
  initialModeOptions,
  initialModeOptionsAreFallback,
  manageUrl,
}: OwnerPreviewAssistantProps) {
  const t = useTranslations('chat.ownerPreview')
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const setSelectedMode = useSettingsStore((state) => state.setSelectedMode)
  const effectiveMode = resolveSelectedMode(initialModeOptions, selectedMode)

  useEffect(() => {
    if (effectiveMode && effectiveMode !== selectedMode) {
      setSelectedMode(effectiveMode)
    }
  }, [effectiveMode, selectedMode, setSelectedMode])

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: `/api/manage/chatbots/${encodeURIComponent(chatbot.id)}/preview/chat`,
        body: { selectedMode: effectiveMode ?? 'tutor' },
      }),
    [chatbot.id, effectiveMode]
  )
  const runtime = useChatRuntime({ transport })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="bg-background flex h-dvh w-full flex-col overflow-hidden">
        <header className="border-border bg-card shrink-0 border-b px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold">
                  {chatbot.name}
                </h1>
                <span className="border-primary/20 bg-primary/5 text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold">
                  <FlaskConicalIcon className="size-3.5" />
                  {t('badge')}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('description')}
              </p>
            </div>
            <a
              href={manageUrl}
              className="border-border bg-background hover:bg-accent focus-visible:ring-ring inline-flex min-h-10 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              {t('backToManage')}
            </a>
          </div>
        </header>

        <main id="main-content" className="flex min-h-0 flex-1 flex-col">
          <Thread
            chatbotAvatar={chatbot.avatar ?? ''}
            chatbotName={chatbot.name}
            initialModeOptions={initialModeOptions}
            initialModeOptionsAreFallback={initialModeOptionsAreFallback}
            maxImageAttachments={0}
          />
        </main>
      </div>
    </AssistantRuntimeProvider>
  )
}
