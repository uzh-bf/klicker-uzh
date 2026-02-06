import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type ReasoningMessagePartProps,
  ThreadPrimitive,
  useMessage,
} from '@assistant-ui/react'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import {
  ArrowDownIcon,
  CheckIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { type FC, useState } from 'react'

import { Button } from '@uzh-bf/design-system'
import { useSettingsStore } from '../stores/settingsStore'
import { BranchPicker } from './branch-picker'
import { MarkdownText } from './markdown-text'
import { ToolFallback } from './tool-fallback'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

import Image from 'next/image'

import { twMerge } from 'tailwind-merge'

type ThreadProps = { chatbotAvatar: string }

const formatCredits = (value: number) => {
  if (!Number.isFinite(value)) return '0'
  const absValue = Math.abs(value)
  if (absValue === 0) return '0'

  const decimals =
    absValue < 1 ? Math.max(1, -Math.floor(Math.log10(absValue))) : 0
  const rounded = value.toFixed(decimals)
  return rounded.replace(/0+$/, '').replace(/\.$/, '')
}

const formatTitleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

type MessageWithCustomMetadata = {
  metadata?: { custom?: Record<string, unknown> | null } | null
}

const MessageMetadata: FC<{ includeCredits?: boolean }> = ({
  includeCredits = false,
}) => {
  const message = useMessage() as MessageWithCustomMetadata
  const { modelOptions } = useSettingsStore()

  const custom = message.metadata?.custom ?? {}
  const chatMode = typeof custom.chatMode === 'string' ? custom.chatMode : null
  const modelId = typeof custom.modelId === 'string' ? custom.modelId : null
  const creditsUsed =
    typeof custom.creditsUsed === 'number' ? custom.creditsUsed : null

  const modeLabel = chatMode ? formatTitleCase(chatMode) : null
  const modelLabel = modelId
    ? modelOptions.find((option) => option.id === modelId)?.name || modelId
    : null

  const parts = [modeLabel ?? '—', modelLabel ?? '—']
  if (includeCredits) {
    const creditsLabel =
      typeof creditsUsed === 'number'
        ? `${formatCredits(creditsUsed)} credits`
        : '—'
    parts.push(creditsLabel)
  }

  return (
    <div className="text-muted-foreground mt-1 text-xs">
      {parts.join(' — ')}
    </div>
  )
}

const AssistantReasoningPart: FC<ReasoningMessagePartProps> = ({ text }) => {
  const message = useMessage() as MessageWithCustomMetadata
  const [isOpen, setIsOpen] = useState(false)

  const custom = message.metadata?.custom ?? {}
  const reasoningEffort =
    typeof custom.reasoningEffort === 'string' ? custom.reasoningEffort : null

  if (!text || text.trim().length === 0) {
    return null
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((state) => !state)}
        className="text-muted-foreground hover:text-foreground text-xs font-medium"
      >
        {isOpen ? 'Hide reasoning' : 'Show reasoning'}
        {reasoningEffort ? ` (${formatTitleCase(reasoningEffort)})` : ''}
      </button>

      {isOpen ? (
        <pre className="text-muted-foreground mt-2 whitespace-pre-wrap text-xs leading-5">
          {text}
        </pre>
      ) : null}
    </div>
  )
}

export const Thread: FC<ThreadProps> = ({ chatbotAvatar }) => {
  return (
    <ThreadPrimitive.Root
      className="bg-background box-border flex h-full flex-col overflow-hidden"
      style={{
        ['--thread-max-width' as string]: '60rem',
      }}
    >
      <ThreadPrimitive.Viewport className="flex h-full flex-col items-center overflow-y-scroll scroll-smooth bg-inherit px-4 pt-8">
        <ThreadWelcome />

        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessage,
            EditComposer: EditComposer,
            AssistantMessage: (props) => (
              <AssistantMessage {...props} chatbotAvatar={chatbotAvatar} />
            ),
          }}
        />

        <ThreadPrimitive.If empty={false}>
          <div className="min-h-8 flex-grow" />
        </ThreadPrimitive.If>

        <div className="sticky bottom-0 mt-3 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit pb-4">
          <ThreadScrollToBottom />
          <Composer />
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

const ThreadScrollToBottom: FC = () => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ThreadPrimitive.ScrollToBottom asChild>
          <button className="border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring absolute -top-8 inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-full border text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:invisible disabled:opacity-50">
            <ArrowDownIcon />
            <span className="sr-only">Scroll to bottom</span>
          </button>
        </ThreadPrimitive.ScrollToBottom>
      </TooltipTrigger>
      <TooltipContent>Scroll to bottom</TooltipContent>
    </Tooltip>
  )
}

const ThreadWelcome: FC = () => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="flex w-full flex-grow flex-col items-center justify-center">
          <p className="mt-4 font-medium">How can I help you today?</p>
        </div>
        {/* <ThreadWelcomeSuggestions /> */}
      </div>
    </ThreadPrimitive.Empty>
  )
}

// const ThreadWelcomeSuggestions: FC = () => {
//   const suggestions = getThreadSuggestions()

//   return (
//     <div className="mt-3 flex w-full items-stretch justify-center gap-4">
//       {suggestions.map((suggestion) => (
//         <ThreadPrimitive.Suggestion
//           key={suggestion.id}
//           className="hover:bg-muted/80 flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-lg border p-3 transition-colors ease-in"
//           prompt={suggestion.prompt}
//           method="replace"
//           autoSend
//         >
//           <span className="line-clamp-2 text-ellipsis text-sm font-semibold">
//             {suggestion.text}
//           </span>
//         </ThreadPrimitive.Suggestion>
//       ))}
//     </div>
//   )
// }

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="focus-within:border-ring/20 flex w-full flex-wrap items-center rounded-lg border bg-inherit px-2.5 shadow-sm transition-colors ease-in">
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder="Write a message..."
        className="placeholder:text-muted-foreground max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed"
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  )
}

const ComposerAction: FC = () => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <Button
            style={{
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              minWidth: '36px',
              minHeight: '36px',
              padding: '0',
              paddingLeft: '5px',
            }}
            className={{
              root: 'm-2 flex h-12 w-12 items-center justify-center rounded-lg',
            }}
          >
            <Button.Icon icon={faPaperPlane} />
          </Button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            style={{
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              minWidth: '36px',
              minHeight: '36px',
              padding: '0',
            }}
            className={{
              root: 'm-2 flex h-12 w-12 items-center justify-center rounded-lg',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              width="20"
              height="20"
            >
              <rect width="10" height="10" x="3" y="3" rx="2" />
            </svg>
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  )
}

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 py-4 [&:where(>*)]:col-start-2">
      <UserActionBar />

      <div className="bg-muted text-foreground col-start-2 row-start-2 max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl px-5 py-2.5">
        <MessagePrimitive.Content />
      </div>

      <div className="col-start-2 row-start-3 max-w-[calc(var(--thread-max-width)*0.8)]">
        <MessageMetadata />
      </div>
    </MessagePrimitive.Root>
  )
}

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="col-start-1 row-start-2 mr-3 mt-2.5 flex flex-col items-end"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ActionBarPrimitive.Edit asChild>
            <button className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50">
              <PencilIcon />
              <span className="sr-only">Edit</span>
            </button>
          </ActionBarPrimitive.Edit>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>

      <BranchPickerWrapper />
    </ActionBarPrimitive.Root>
  )
}

const EditComposer: FC = () => {
  return (
    <ComposerPrimitive.Root className="bg-muted my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-xl">
      <ComposerPrimitive.Input className="text-foreground flex h-8 w-full resize-none bg-transparent p-4 pb-0 outline-none" />

      <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
            }}
            className={{
              root: 'hover:!bg-gray-800',
            }}
          >
            <Button.Label>Cancel</Button.Label>
          </Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button
            style={{
              backgroundColor: '#ffffff',
              color: '#000000',
            }}
            className={{
              root: 'hover:!bg-gray-100',
            }}
          >
            <Button.Label>Send</Button.Label>
          </Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  )
}

const AssistantMessage: FC<{ chatbotAvatar: string }> = ({ chatbotAvatar }) => {
  return (
    <MessagePrimitive.Root className="relative grid w-full max-w-[var(--thread-max-width)] grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] py-4">
      {/* Avatar image in first column */}
      <div className="col-start-1 row-span-2 row-start-1 mr-3 mt-3 flex items-start pr-2">
        <Image
          src={
            chatbotAvatar
              ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${chatbotAvatar}.svg`
              : '../../public/user-solid.svg'
          }
          alt=""
          width={chatbotAvatar ? '35' : '32'}
          height="35"
          className={twMerge(
            'hover:bg-uzh-red-20 cursor-pointer rounded-full bg-white',
            chatbotAvatar ? '' : 'p-1'
          )}
        />
      </div>
      <div className="text-foreground col-span-2 col-start-2 row-start-1 my-1.5 max-w-[calc(var(--thread-max-width)*0.8)] break-words leading-7">
        <MessagePrimitive.Content
          components={{
            Text: MarkdownText,
            Reasoning: AssistantReasoningPart,
            tools: { Fallback: ToolFallback },
          }}
        />
        <MessageMetadata includeCredits />
      </div>

      <AssistantActionBar />
    </MessagePrimitive.Root>
  )
}

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="text-muted-foreground data-[floating]:bg-background col-start-3 row-start-2 -ml-1 flex gap-1 data-[floating]:absolute data-[floating]:rounded-md data-[floating]:border data-[floating]:p-1 data-[floating]:shadow-sm"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ActionBarPrimitive.Copy asChild>
            <button className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50">
              <MessagePrimitive.If copied>
                <CheckIcon />
              </MessagePrimitive.If>
              <MessagePrimitive.If copied={false}>
                <CopyIcon />
              </MessagePrimitive.If>
              <span className="sr-only">Copy</span>
            </button>
          </ActionBarPrimitive.Copy>
        </TooltipTrigger>
        <TooltipContent>Copy</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ActionBarPrimitive.Reload asChild>
            <button className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50">
              <RefreshCwIcon />
              <span className="sr-only">Refresh</span>
            </button>
          </ActionBarPrimitive.Reload>
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>

      <BranchPickerWrapper />
    </ActionBarPrimitive.Root>
  )
}

const BranchPickerWrapper: FC = () => {
  const message = useMessage()
  return <BranchPicker messageId={message.id} />
}
