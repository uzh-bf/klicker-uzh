import {
  ActionBarPrimitive,
  groupPartByType,
  MessagePrimitive,
  type ReasoningMessagePartProps,
  useAuiState,
} from '@assistant-ui/react'
import { Markdown } from '@klicker-uzh/markdown'
import {
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FC, type PropsWithChildren, useState } from 'react'

import {
  MarkdownText,
  normalizeCustomMathTags,
} from '@/src/components/markdown-text'
import { formatReasoningEffort } from '@/src/lib/config/reasoning'
import { resolveDisclosureOpen } from './message-parts-state'
import { ToolFallback } from './tool-fallback'

type MessageWithCustomMetadata = {
  metadata?: {
    custom?: Record<string, unknown> | null
  } | null
}

const GroupedDisclosure: FC<
  PropsWithChildren<{
    active: boolean
    autoOpen?: boolean
    contentClassName: string
    dataCy: string
    label: string
  }>
> = ({
  active,
  autoOpen = false,
  children,
  contentClassName,
  dataCy,
  label,
}) => {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const isOpen = resolveDisclosureOpen(manualOpen, autoOpen, active)

  return (
    <div className="mt-1">
      <button
        type="button"
        data-cy={dataCy}
        aria-expanded={isOpen}
        onClick={() => setManualOpen(!isOpen)}
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-xs touch-manipulation fine-pointer:min-h-8"
      >
        {isOpen ? (
          <ChevronDownIcon className="size-3" />
        ) : (
          <ChevronRightIcon className="size-3" />
        )}
        {active ? (
          <LoaderCircleIcon className="text-primary size-3 animate-spin" />
        ) : null}
        {label}
      </button>
      {isOpen ? <div className={contentClassName}>{children}</div> : null}
    </div>
  )
}

const ReasoningPart: FC<ReasoningMessagePartProps> = ({ text }) => {
  const normalizedText = text?.replace(
    /([^\n])(\*\*[^*\n]+\*\*\n)/g,
    '$1\n\n$2'
  )

  if (!normalizedText || normalizedText.trim().length === 0) {
    return null
  }

  return (
    <Markdown
      content={normalizeCustomMathTags(normalizedText)}
      singleDollarTextMath
    />
  )
}

const ReasoningGroup: FC<
  PropsWithChildren<{
    active: boolean
  }>
> = ({ active, children }) => {
  const t = useTranslations()
  const message = useAuiState((s) => s.message) as MessageWithCustomMetadata
  const reasoningEffort = message.metadata?.custom?.reasoningEffort
  const effortLabel =
    typeof reasoningEffort === 'string'
      ? ` (${formatReasoningEffort(t, reasoningEffort)})`
      : ''

  return (
    <GroupedDisclosure
      active={active}
      autoOpen
      dataCy="chat-reasoning-toggle"
      label={`${t('chat.message.reasoningToggle')}${effortLabel}`}
      contentClassName="text-muted-foreground border-border mb-2 border-l-2 pl-3 text-sm"
    >
      {children}
    </GroupedDisclosure>
  )
}

const ToolGroup: FC<
  PropsWithChildren<{
    active: boolean
    count: number
  }>
> = ({ active, children, count }) => {
  const t = useTranslations()

  return (
    <GroupedDisclosure
      active={active}
      dataCy="chat-tool-group-toggle"
      label={t('chat.message.toolCallsGroupLabel', { count })}
      contentClassName="border-border mt-1 border-l-2 pl-3"
    >
      {children}
    </GroupedDisclosure>
  )
}

type ChatErrorPartData = {
  errorLabel: string
  message: string
}

/**
 * Visually distinct callout for a stream/send failure (`useChatResponse.ts`
 * pushes it as a `data`/`chat-error` content part instead of markdown text,
 * so it can't be confused with model output). Reuses the failed-tool-chip
 * treatment (`bg-destructive/10 text-foreground`) from `tool-fallback.tsx`.
 */
const ChatErrorPart: FC<{ data: ChatErrorPartData }> = ({ data }) => {
  const t = useTranslations()

  return (
    <div
      data-cy="chat-message-error"
      role="alert"
      className="bg-destructive/10 text-foreground mt-2 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <AlertCircleIcon
          className="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <p>
          <span className="font-medium">{data.errorLabel}</span>
          {`: ${data.message}`}
        </p>
      </div>
      <ActionBarPrimitive.Reload asChild>
        <button
          type="button"
          data-cy="chat-retry-message-button"
          className="hover:bg-destructive/15 focus-visible:ring-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-1 fine-pointer:min-h-8"
        >
          <RefreshCwIcon className="size-4" aria-hidden />
          {t('chat.message.retry')}
        </button>
      </ActionBarPrimitive.Reload>
    </div>
  )
}

export const AssistantMessageParts: FC = () => (
  <MessagePrimitive.GroupedParts
    indicator="never"
    groupBy={groupPartByType({
      reasoning: ['group-reasoning'],
      'tool-call': ['group-tool'],
    })}
  >
    {({ part, children }) => {
      switch (part.type) {
        case 'group-reasoning':
          return (
            <ReasoningGroup active={part.status.type === 'running'}>
              {children}
            </ReasoningGroup>
          )
        case 'group-tool':
          return part.indices.length <= 1 ? (
            <>{children}</>
          ) : (
            <ToolGroup
              active={part.status.type === 'running'}
              count={part.indices.length}
            >
              {children}
            </ToolGroup>
          )
        case 'text':
          return <MarkdownText />
        case 'reasoning':
          return <ReasoningPart {...part} />
        case 'tool-call':
          return part.toolUI ?? <ToolFallback {...part} />
        case 'data':
          return part.name === 'chat-error' ? (
            <ChatErrorPart data={part.data as ChatErrorPartData} />
          ) : null
        default:
          return null
      }
    }}
  </MessagePrimitive.GroupedParts>
)
