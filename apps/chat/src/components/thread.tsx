import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type ReasoningMessagePartProps,
  ThreadPrimitive,
  useMessage,
  useThreadComposerAttachment,
} from '@assistant-ui/react'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ImagePlusIcon,
  PencilIcon,
  PencilOffIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react'
import { type FC, type PropsWithChildren, useState } from 'react'

import { Button } from '@uzh-bf/design-system'
import { useComposerStore } from '../stores/composerStore'
import { useSettingsStore } from '../stores/settingsStore'
import { BranchPicker } from './branch-picker'
import { useChatUi } from './chat-ui-context'
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
  attachment?: {
    type?: 'image'
    imageBase64?: string | null
    imageDescription?: string | null
  } | null
  metadata?: {
    custom?:
      | (Record<string, unknown> & {
          attachment?: {
            type?: 'image'
            imageBase64?: string | null
            imageDescription?: string | null
          } | null
        })
      | null
  } | null
}

const MessageMetadata: FC<{ includeCredits?: boolean }> = ({
  includeCredits = false,
}) => {
  const message = useMessage() as MessageWithCustomMetadata & {
    role: string
    status?: { type: string }
  }
  const { modelOptions } = useSettingsStore()

  // Hide metadata while the assistant is still streaming
  if (message.role === 'assistant' && message.status?.type === 'running') {
    return null
  }

  const custom = message.metadata?.custom ?? {}
  const chatMode = typeof custom.chatMode === 'string' ? custom.chatMode : null
  const modelId = typeof custom.modelId === 'string' ? custom.modelId : null
  const reasoningEffort =
    typeof custom.reasoningEffort === 'string' ? custom.reasoningEffort : null
  const creditsUsed =
    typeof custom.creditsUsed === 'number' ? custom.creditsUsed : null

  const modeLabel = chatMode ? formatTitleCase(chatMode) : null
  const modelLabel = modelId
    ? modelOptions.find((option) => option.id === modelId)?.name || modelId
    : null
  const reasoningLabel = reasoningEffort
    ? formatTitleCase(reasoningEffort)
    : null

  const parts = [modeLabel, modelLabel, reasoningLabel].filter(Boolean)
  if (includeCredits && typeof creditsUsed === 'number') {
    parts.push(`${formatCredits(creditsUsed)} credits`)
  }

  if (parts.length === 0) return null

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
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((state) => !state)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        {isOpen ? (
          <ChevronDownIcon className="size-3" />
        ) : (
          <ChevronRightIcon className="size-3" />
        )}
        Reasoning
        {reasoningEffort ? ` (${formatTitleCase(reasoningEffort)})` : ''}
      </button>

      {isOpen ? (
        <pre className="text-muted-foreground mt-1 whitespace-pre-wrap border-l-2 border-slate-200 pl-3 text-xs leading-5">
          {text}
        </pre>
      ) : null}
    </div>
  )
}

export const Thread: FC<ThreadProps> = ({ chatbotAvatar }) => {
  const { embedded } = useChatUi()

  return (
    <ThreadPrimitive.Root
      className="bg-background relative box-border flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        ['--thread-max-width' as string]: embedded ? '100%' : '60rem',
      }}
    >
      <ThreadPrimitive.Viewport
        className={twMerge(
          'flex min-h-0 flex-1 flex-col items-center scroll-smooth bg-inherit',
          embedded
            ? 'scrollbar-none overflow-y-auto px-2 pb-24 pt-2'
            : 'overflow-y-scroll px-2 pb-28 pt-2 sm:px-4 sm:pt-8'
        )}
      >
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
      </ThreadPrimitive.Viewport>

      <div
        className={twMerge(
          'absolute bottom-0 left-0 right-0 z-10 flex w-full flex-col items-center justify-end',
          embedded ? 'px-2 pb-2' : 'px-2 pb-4 sm:px-4'
        )}
      >
        <div className="from-background pointer-events-none absolute inset-x-0 bottom-full h-12 to-transparent" />
        {!embedded && <ThreadScrollToBottom />}
        <Composer />
      </div>
    </ThreadPrimitive.Root>
  )
}

const ThreadScrollToBottom: FC = () => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ThreadPrimitive.ScrollToBottom asChild>
          <button className="border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring absolute bottom-full mb-2 inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-full border text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:invisible disabled:opacity-50">
            <ArrowDownIcon />
            <span className="sr-only">Scroll to bottom</span>
          </button>
        </ThreadPrimitive.ScrollToBottom>
      </TooltipTrigger>
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
  const { embedded } = useChatUi()
  const attachmentError = useComposerStore((s) => s.attachmentError)
  const setAttachmentError = useComposerStore((s) => s.setAttachmentError)

  return (
    <ComposerPrimitive.Root className="flex w-full max-w-3xl flex-col rounded-3xl border border-gray-200 bg-gray-100/80 px-2.5 shadow-[0_0_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition-colors ease-in focus-within:border-gray-300">
      <ComposerAttachments />

      {attachmentError && (
        <div className="px-2 pt-2">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
            <span>{attachmentError}</span>
            <button
              type="button"
              onClick={() => setAttachmentError(null)}
              className="rounded hover:bg-red-100"
              aria-label="Dismiss error"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex w-full items-center">
        <ComposerAttachButton />
        <ComposerPrimitive.Input
          rows={1}
          autoFocus
          placeholder="Write a message..."
          className={twMerge(
            'placeholder:text-muted-foreground text-md flex-grow resize-none border-none bg-transparent px-2 outline-none focus:ring-0 disabled:cursor-not-allowed',
            embedded ? 'max-h-20 py-2' : 'max-h-40 py-4'
          )}
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.Root>
  )
}

const ComposerAttachments: FC = () => {
  return (
    <div className="flex w-full flex-wrap gap-2 py-2 empty:hidden">
      <ComposerPrimitive.Attachments
        components={{
          Image: ComposerImageAttachment,
          Document: ComposerImageAttachment,
          File: ComposerImageAttachment,
          Attachment: ComposerImageAttachment,
        }}
      />
    </div>
  )
}

const ComposerImageAttachment: FC = () => {
  const { embedded } = useChatUi()
  const imageSrc = useThreadComposerAttachment((attachment) => {
    const imagePart = attachment.content?.find(
      (
        part
      ): part is {
        type: 'image'
        image: string
      } =>
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'image' &&
        'image' in part &&
        typeof part.image === 'string'
    )

    return imagePart?.image ?? null
  })
  const attachmentName = useThreadComposerAttachment(
    (attachment) => attachment.name
  )

  return (
    <AttachmentPrimitive.Root className="relative">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={attachmentName || 'Attachment preview'}
          className={twMerge(
            'size-14 rounded-md border object-cover',
            embedded ? 'max-h-20 max-w-20' : 'max-h-28 max-w-28'
          )}
        />
      ) : (
        <div
          className={twMerge(
            'text-muted-foreground bg-muted flex size-14 items-center justify-center rounded-md border px-2 text-[10px]',
            embedded ? 'max-h-20 max-w-20' : 'max-h-28 max-w-28'
          )}
        >
          {attachmentName}
        </div>
      )}
      <AttachmentPrimitive.Remove asChild>
        <button
          type="button"
          className="bg-background text-muted-foreground hover:text-foreground absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full border"
          aria-label="Remove attachment"
        >
          ×
        </button>
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  )
}

const ComposerAttachButton: FC = () => {
  const { embedded } = useChatUi()
  const { selectedModel, modelOptions } = useSettingsStore()
  const supportsImages =
    modelOptions.find((m) => m.id === selectedModel)
      ?.supportsImageAttachments !== false

  if (!supportsImages) return null

  return (
    <ComposerPrimitive.AddAttachment asChild>
      <button
        type="button"
        className={twMerge(
          'text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-md',
          embedded ? 'm-1 size-7' : 'm-2 size-9'
        )}
        aria-label="Attach image"
      >
        <ImagePlusIcon className={embedded ? 'size-4' : 'size-5'} />
      </button>
    </ComposerPrimitive.AddAttachment>
  )
}

const ComposerAction: FC = () => {
  const { embedded } = useChatUi()
  const size = embedded ? '28px' : '36px'

  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <Button
            style={{
              borderRadius: '50%',
              width: size,
              height: size,
              minWidth: size,
              minHeight: size,
              padding: '0',
              paddingLeft: embedded ? '3px' : '5px',
            }}
            className={{
              root: twMerge(
                'flex items-center justify-center rounded-lg',
                embedded ? 'm-1' : 'm-2 h-12 w-12'
              ),
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
              width: size,
              height: size,
              minWidth: size,
              minHeight: size,
              padding: '0',
            }}
            className={{
              root: twMerge(
                'flex items-center justify-center rounded-lg',
                embedded ? 'm-1' : 'm-2 h-12 w-12'
              ),
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              width={embedded ? '16' : '20'}
              height={embedded ? '16' : '20'}
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
  const { embedded } = useChatUi()
  const message = useMessage() as MessageWithCustomMetadata
  const attachment =
    (message.attachment && typeof message.attachment === 'object'
      ? message.attachment
      : null) ??
    (message.metadata?.custom?.attachment &&
    typeof message.metadata.custom.attachment === 'object'
      ? message.metadata.custom.attachment
      : null)

  const imageBase64 =
    attachment && typeof attachment.imageBase64 === 'string'
      ? attachment.imageBase64
      : null

  return (
    <MessagePrimitive.Root className="flex w-full max-w-[var(--thread-max-width)] flex-col items-end gap-y-1 py-2 sm:py-4">
      <div className="bg-muted text-foreground max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-2xl px-5 py-2.5">
        {imageBase64 ? (
          <img
            src={imageBase64}
            alt="Attached by user"
            className={twMerge(
              'mb-2 rounded-md border object-cover',
              embedded ? 'max-w-[200px]' : 'max-w-[300px]'
            )}
          />
        ) : null}
        <MessagePrimitive.Content />
      </div>

      <MessageMetadata />
      <div className="flex min-h-6 items-center">
        <UserActionBar />
      </div>
    </MessagePrimitive.Root>
  )
}

const UserActionBar: FC = () => {
  const { showMessageActions } = useChatUi()
  const { selectedModel, modelOptions } = useSettingsStore()
  const message = useMessage() as MessageWithCustomMetadata

  if (!showMessageActions) return null

  const attachment =
    (message.attachment && typeof message.attachment === 'object'
      ? message.attachment
      : null) ??
    (message.metadata?.custom?.attachment &&
    typeof message.metadata.custom.attachment === 'object'
      ? message.metadata.custom.attachment
      : null)
  const hasImage = attachment?.type === 'image' && !!attachment.imageBase64

  const supportsImages =
    modelOptions.find((m) => m.id === selectedModel)
      ?.supportsImageAttachments !== false
  const editDisabled = hasImage && !supportsImages

  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="text-muted-foreground flex items-center gap-1"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          {editDisabled ? (
            <button
              disabled
              className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
            >
              <PencilOffIcon />
              <span className="sr-only">Edit unavailable</span>
            </button>
          ) : (
            <ActionBarPrimitive.Edit asChild>
              <button className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50">
                <PencilIcon />
                <span className="sr-only">Edit</span>
              </button>
            </ActionBarPrimitive.Edit>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {editDisabled
            ? 'Cannot edit: selected model does not support images'
            : 'Edit'}
        </TooltipContent>
      </Tooltip>

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

      <BranchPickerWrapper />
    </ActionBarPrimitive.Root>
  )
}

const EditComposer: FC = () => {
  const { showMessageActions, embedded } = useChatUi()
  const message = useMessage() as MessageWithCustomMetadata
  const attachment =
    (message.attachment && typeof message.attachment === 'object'
      ? message.attachment
      : null) ??
    (message.metadata?.custom?.attachment &&
    typeof message.metadata.custom.attachment === 'object'
      ? message.metadata.custom.attachment
      : null)
  const imageBase64 =
    attachment && typeof attachment.imageBase64 === 'string'
      ? attachment.imageBase64
      : null

  if (!showMessageActions) return null

  return (
    <ComposerPrimitive.Root className="bg-muted my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-2xl">
      {imageBase64 ? (
        <img
          src={imageBase64}
          alt="Attached by user"
          className={twMerge(
            'mb-0 ml-4 mt-3 rounded-md border object-cover',
            embedded ? 'max-w-[200px]' : 'max-w-[300px]'
          )}
        />
      ) : null}
      <ComposerPrimitive.Input className="text-foreground flex min-h-[2.5rem] w-full resize-none bg-transparent px-4 py-3 outline-none" />

      <div className="mx-3 mb-2 flex items-center justify-center gap-2 self-end">
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

const groupConsecutiveByType = (
  parts: readonly { type: string }[]
): { groupKey: string | undefined; indices: number[] }[] => {
  const groups: { groupKey: string | undefined; indices: number[] }[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    const key =
      part.type === 'reasoning' || part.type === 'tool-call'
        ? part.type
        : undefined

    const prev = groups[groups.length - 1]
    if (prev && key !== undefined && prev.groupKey === key) {
      prev.indices.push(i)
    } else {
      groups.push({ groupKey: key, indices: [i] })
    }
  }

  return groups
}

const PartGroup: FC<
  PropsWithChildren<{ groupKey: string | undefined; indices: number[] }>
> = ({ groupKey, indices, children }) => {
  const [isOpen, setIsOpen] = useState(false)

  if (!groupKey || indices.length <= 1) {
    return <>{children}</>
  }

  const label =
    groupKey === 'reasoning'
      ? `Reasoning (${indices.length} parts)`
      : `${indices.length} tool calls`

  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((s) => !s)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        {isOpen ? (
          <ChevronDownIcon className="size-3" />
        ) : (
          <ChevronRightIcon className="size-3" />
        )}
        {label}
      </button>
      {isOpen ? (
        <div className="mt-1 border-l-2 border-slate-200 pl-3">{children}</div>
      ) : null}
    </div>
  )
}

const AssistantMessage: FC<{
  chatbotAvatar: string
}> = ({ chatbotAvatar }) => {
  const { embedded } = useChatUi()

  return (
    <MessagePrimitive.Root
      className={twMerge(
        'relative grid w-full max-w-[var(--thread-max-width)] grid-rows-[auto_1fr] py-2 sm:py-4',
        embedded ? 'grid-cols-[auto_1fr]' : 'grid-cols-[auto_auto_1fr]'
      )}
    >
      {!embedded && (
        <div className="col-start-1 row-span-2 row-start-1 mr-2 mt-2 flex items-start pr-1 sm:mr-3 sm:mt-3 sm:pr-2">
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
              'hover:bg-uzh-red-20 hidden cursor-pointer rounded-full bg-white sm:block',
              chatbotAvatar ? '' : 'p-1'
            )}
          />
          <Image
            src={
              chatbotAvatar
                ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${chatbotAvatar}.svg`
                : '../../public/user-solid.svg'
            }
            alt=""
            width="24"
            height="24"
            className={twMerge(
              'hover:bg-uzh-red-20 cursor-pointer rounded-full bg-white sm:hidden',
              chatbotAvatar ? '' : 'p-1'
            )}
          />
        </div>
      )}
      <div
        className={twMerge(
          'text-foreground col-span-2 row-start-1 my-1.5 break-words leading-7',
          embedded
            ? 'col-start-1 max-w-full'
            : 'col-start-2 max-w-[calc(var(--thread-max-width)*0.8)]'
        )}
      >
        <MessagePrimitive.Unstable_PartsGrouped
          groupingFunction={groupConsecutiveByType}
          components={{
            Text: MarkdownText,
            Reasoning: AssistantReasoningPart,
            tools: { Fallback: ToolFallback },
            Group: PartGroup,
          }}
        />
        <MessageMetadata includeCredits />
      </div>

      <AssistantActionBar embedded={embedded} />
    </MessagePrimitive.Root>
  )
}

const AssistantActionBar: FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { showMessageActions } = useChatUi()
  if (!showMessageActions) return null

  return (
    <div
      className={twMerge(
        'row-start-2 min-h-8',
        embedded ? 'col-start-2' : 'col-start-3'
      )}
    >
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        className="text-muted-foreground -ml-1 flex gap-1"
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
    </div>
  )
}

const BranchPickerWrapper: FC = () => {
  const message = useMessage()
  return <BranchPicker messageId={message.id} />
}
