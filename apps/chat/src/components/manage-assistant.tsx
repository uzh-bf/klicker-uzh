'use client'

import {
  AssistantRuntimeProvider,
  useAui,
  useAuiState,
} from '@assistant-ui/react'
import {
  AssistantChatTransport,
  useChatRuntime,
} from '@assistant-ui/react-ai-sdk'
import {
  BookOpenTextIcon,
  FilePenLineIcon,
  MessageSquareTextIcon,
  RotateCcwIcon,
  SearchIcon,
  WandSparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useEmbeddedManageContext } from '../hooks/useEmbeddedManageContext'
import { imageAttachmentAdapter } from '../lib/attachments/imageAttachmentAdapter'
import { MAX_MANAGE_IMAGE_ATTACHMENTS } from '../lib/config/attachmentLimits'
import { getManageSuggestions } from '../lib/config/manageSuggestions'
import {
  getManageContextLabel,
  type ManageAssistantContext,
} from '../services/manageContext'
import { ChatUiProvider, useChatUi } from './chat-ui-context'
import { EmbeddedSettings } from './embedded-settings'
import { Thread, type ThreadWelcomeCapability } from './thread'

const MANAGE_ASSISTANT_NAME = 'KlickerUZH Assistant'
const MANAGE_ASSISTANT_WELCOME = 'Hello! How can I help you?'
const MANAGE_ASSISTANT_CAPABILITIES: ThreadWelcomeCapability[] = [
  { icon: SearchIcon, text: 'Search your courses and question pool' },
  {
    icon: FilePenLineIcon,
    text: 'Draft single-choice, multiple-choice, and free-text questions — saved to your pool only after you confirm',
  },
  {
    icon: MessageSquareTextIcon,
    text: 'Suggest improvements to question feedback',
  },
  {
    icon: BookOpenTextIcon,
    text: 'Explain KlickerUZH features using its documentation and tutorials',
  },
]
const MANAGE_ASSISTANT_LIMITS_NOTE =
  'Read-only for everything else — it never publishes or edits existing content.'

export function ManageAssistant() {
  return (
    <ChatUiProvider>
      <ManageAssistantInner />
    </ChatUiProvider>
  )
}

function ManageAssistantInner() {
  const { embedded } = useChatUi()
  const context = useEmbeddedManageContext()
  const contextLabel = getManageContextLabel(context)
  const suggestions = getManageSuggestions(context)

  return (
    <ManageAssistantRuntimeProvider context={context}>
      <div className="relative flex h-dvh w-full flex-col overflow-hidden">
        {!embedded && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-white px-3 py-2.5 sm:px-4">
            <ManageAssistantAvatar className="size-9" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {MANAGE_ASSISTANT_NAME}
              </div>
              <div className="mt-1 inline-flex max-w-full items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium leading-tight text-blue-800">
                <span className="truncate">{contextLabel ?? 'Manage'}</span>
              </div>
            </div>
            <ManageAssistantToolbar />
          </div>
        )}
        {embedded && (
          <div className="absolute right-3 top-3 z-10">
            <ManageAssistantToolbar />
          </div>
        )}
        <Thread
          chatbotAvatar=""
          chatbotFallbackIcon={WandSparkles}
          chatbotName={MANAGE_ASSISTANT_NAME}
          contextLabel={contextLabel}
          suggestions={suggestions}
          welcomeMessage={MANAGE_ASSISTANT_WELCOME}
          capabilities={MANAGE_ASSISTANT_CAPABILITIES}
          limitsNote={MANAGE_ASSISTANT_LIMITS_NOTE}
          maxImageAttachments={MAX_MANAGE_IMAGE_ATTACHMENTS}
        />
      </div>
    </ManageAssistantRuntimeProvider>
  )
}

function ManageAssistantToolbar() {
  const t = useTranslations()
  const aui = useAui()
  const isRunning = useAuiState((state) => state.thread.isRunning)
  const messageCount = useAuiState((state) => state.thread.messages.length)
  const composerIsEmpty = useAuiState((state) => state.composer.isEmpty)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const hasConversation = messageCount > 0 || !composerIsEmpty

  async function handleReset() {
    if (isRunning) return
    if (hasConversation && !confirmingReset) {
      setConfirmingReset(true)
      return
    }

    setConfirmingReset(false)
    await aui.composer.reset()
    aui.thread.reset()
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <EmbeddedSettings />
      <button
        type="button"
        disabled={isRunning}
        onClick={() => void handleReset()}
        onBlur={() => setConfirmingReset(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setConfirmingReset(false)
          }
        }}
        aria-label={
          confirmingReset
            ? t('chat.assistant.confirmNewConversation')
            : t('chat.assistant.newConversation')
        }
        title={
          isRunning
            ? t('chat.assistant.newConversationWait')
            : t('chat.assistant.newConversation')
        }
        data-cy="manage-assistant-new-conversation"
        className={twMerge(
          'focus-visible:ring-ring inline-flex h-7 shrink-0 items-center justify-center rounded-md border bg-white text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          confirmingReset
            ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 gap-1.5 px-2'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground w-7'
        )}
      >
        <RotateCcwIcon aria-hidden className="size-3.5" />
        {confirmingReset ? (
          <span>{t('chat.assistant.confirmNewConversationShort')}</span>
        ) : null}
      </button>
      <span role="status" className="sr-only">
        {confirmingReset ? t('chat.assistant.newConversationArmed') : ''}
      </span>
    </div>
  )
}

function ManageAssistantRuntimeProvider({
  children,
  context,
}: {
  children: React.ReactNode
  context: ManageAssistantContext | null
}) {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: '/api/manage/chat',
        body: {
          manageContext: context ?? undefined,
        },
      }),
    [context]
  )

  const runtime = useChatRuntime({
    transport,
    adapters: {
      attachments: imageAttachmentAdapter,
    },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}

function ManageAssistantAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={twMerge(
        'text-uzh-blue inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50',
        className
      )}
    >
      <span className="flex size-full items-center justify-center bg-gradient-to-br from-white via-blue-50 to-cyan-50">
        <WandSparkles className="size-4" />
      </span>
    </span>
  )
}
