import {
  groupPartByType,
  MessagePrimitive,
  type ReasoningMessagePartProps,
  useMessage,
} from '@assistant-ui/react'
import { Markdown } from '@klicker-uzh/markdown'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
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
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
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
  const message = useMessage() as MessageWithCustomMetadata
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
        default:
          return null
      }
    }}
  </MessagePrimitive.GroupedParts>
)
