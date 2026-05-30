'use client'

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { WandSparkles } from 'lucide-react'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useEmbeddedManageContext } from '../hooks/useEmbeddedManageContext'
import { imageAttachmentAdapter } from '../lib/attachments/imageAttachmentAdapter'
import {
  formatManageContextForPrompt,
  getManageContextLabel,
  type ManageAssistantContext,
} from '../services/manageContext'
import { ChatUiProvider } from './chat-ui-context'
import { EmbeddedSettings } from './embedded-settings'
import { Thread } from './thread'

const MANAGE_ASSISTANT_NAME = 'Klicker assistant'

export function ManageAssistant() {
  return (
    <ChatUiProvider>
      <ManageAssistantInner />
    </ChatUiProvider>
  )
}

function ManageAssistantInner() {
  const context = useEmbeddedManageContext()
  const contextLabel = getManageContextLabel(context)

  return (
    <ManageAssistantRuntimeProvider context={context}>
      <div className="flex h-dvh w-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-white px-3 py-2.5 sm:px-4">
          <ManageAssistantAvatar className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {MANAGE_ASSISTANT_NAME}
            </div>
            {contextLabel && (
              <div className="mt-1 inline-flex max-w-full items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium leading-tight text-blue-800">
                <span className="truncate">{contextLabel}</span>
              </div>
            )}
          </div>
          <EmbeddedSettings />
        </div>
        <Thread
          chatbotAvatar=""
          chatbotName={MANAGE_ASSISTANT_NAME}
          contextLabel={contextLabel}
          suggestionMode="manage"
        />
      </div>
    </ManageAssistantRuntimeProvider>
  )
}

function ManageAssistantRuntimeProvider({
  children,
  context,
}: {
  children: React.ReactNode
  context: ManageAssistantContext | null
}) {
  const [messages, setMessagesState] = useState<ThreadMessageLike[]>([])

  const setMessages = useCallback(
    (nextMessages: readonly ThreadMessageLike[]) => {
      setMessagesState([...nextMessages])
    },
    []
  )

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const userMessage: ThreadMessageLike = {
        ...message,
        id: createLocalMessageId(),
        createdAt: new Date(),
        metadata: {
          ...message.metadata,
          custom: {
            ...(message.metadata?.custom ?? {}),
            assistantKind: 'manage',
          },
        },
      }
      const assistantMessage: ThreadMessageLike = {
        id: createLocalMessageId(),
        role: 'assistant',
        createdAt: new Date(),
        content: [
          {
            type: 'text',
            text: buildPlaceholderReply(context),
          },
        ],
        status: { type: 'complete', reason: 'stop' },
        metadata: {
          custom: {
            assistantKind: 'manage',
            hasManageContext: Boolean(context),
          },
        },
      }

      setMessagesState((current) => [...current, userMessage, assistantMessage])
    },
    [context]
  )

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: false,
    setMessages,
    onNew,
    convertMessage: (message) => message,
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

function buildPlaceholderReply(context: ManageAssistantContext | null) {
  const contextPrompt = formatManageContextForPrompt(context)

  return [
    contextPrompt
      ? `I can see this Manage context:\n\n${contextPrompt}`
      : 'I am ready in the Manage workspace.',
    'The dedicated lecturer assistant route is connected. Tool-backed drafting and confirmed writes will be added in the next slices.',
  ].join('\n\n')
}

function createLocalMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `manage-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
