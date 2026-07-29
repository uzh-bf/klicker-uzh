import { imageAttachmentAdapter } from '@/src/lib/attachments/imageAttachmentAdapter'
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  type ReasoningMessagePartProps,
  ThreadPrimitive,
  useComposer,
  useComposerRuntime,
  useEditComposer,
  useEditComposerAttachment,
  useMessage,
  useMessageRuntime,
  useThreadComposerAttachment,
  useThreadRuntime,
} from '@assistant-ui/react'
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
  SendHorizontalIcon,
  SquareIcon,
  XIcon,
} from 'lucide-react'
import {
  type ComponentType,
  type FC,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  MarkdownText,
  normalizeCustomMathTags,
} from '@/src/components/markdown-text'
import {
  getImageAttachmentKey,
  hasAnyImageAttachmentData,
} from '@/src/lib/attachments/attachmentState'
import { getAttachmentPreviewSrc } from '@/src/lib/attachments/attachmentUi'
import { MAX_IMAGE_ATTACHMENTS } from '@/src/lib/config/attachmentLimits'
import type { ThreadSuggestion } from '@/src/lib/config/manageSuggestions'
import { useComposerStore } from '@/src/stores/composerStore'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { Button } from '@uzh-bf/design-system'
import { BranchPicker } from './branch-picker'
import { useChatUi } from './chat-ui-context'
import { ChatbotAvatar } from './chatbot-avatar'
import { MessageAttachments } from './message-attachments'
import {
  ThreadWelcomeCapabilities,
  type ThreadWelcomeCapability,
} from './thread-welcome-capabilities'
import { ToolFallback } from './tool-fallback'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

import { Markdown } from '@klicker-uzh/markdown'
import { twMerge } from 'tailwind-merge'

// Re-exported for backward compatibility: callers (e.g. manage-assistant.tsx)
// import this type from './thread' — the type itself now lives in
// './thread-welcome-capabilities' alongside the component that uses it.
export type { ThreadWelcomeCapability }

type ThreadProps = {
  chatbotAvatar: string
  chatbotFallbackIcon?: ComponentType<{ className?: string }>
  chatbotName: string
  contextLabel?: string | null
  contextualSuggestions?: boolean
  // Fully resolved suggestion list (e.g. from `getManageSuggestions`). When
  // provided, this takes precedence over the default student suggestions.
  suggestions?: ThreadSuggestion[]
  // Friendly greeting shown above the suggestions (e.g. the manage assistant).
  // When unset, the welcome falls back to `Ask {chatbotName}`.
  welcomeMessage?: string
  // Short capability bullets (icon + text) shown between the greeting and the
  // suggestions (e.g. the manage assistant explaining what it can help with).
  // When unset/empty, nothing extra is rendered.
  capabilities?: ThreadWelcomeCapability[]
  // One-line note shown below the capability bullets (e.g. clarifying the
  // assistant's limits). Ignored when `capabilities` is unset/empty.
  limitsNote?: string
  maxImageAttachments?: number
}
const EMPTY_REMOVED_ATTACHMENT_KEYS: string[] = []
const attachmentLimitErrorMessage = (maxImageAttachments: number) =>
  `You can only attach up to ${maxImageAttachments} images.`

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

type ImageAttachment = {
  id?: string
  type: 'image'
  position?: number
  imageBase64?: string | null
  imagePreviewBase64?: string | null
  imageDescription?: string | null
  hasFullImage?: boolean
}

type MessageWithCustomMetadata = {
  id: string
  parentId?: string | null
  content?: readonly { type: string; text?: string }[]
  attachmentSourceMessageId?: string | null
  imageAttachments?: ImageAttachment[]
  metadata?: {
    custom?:
      | (Record<string, unknown> & {
          imageAttachments?: ImageAttachment[]
        })
      | null
  } | null
}

const extractMessageText = (message: {
  content?: readonly { type: string; text?: string }[]
}): string =>
  (message.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('')

const useSupportsImageAttachments = () => {
  const { selectedModel, modelOptions } = useSettingsStore()

  return (
    modelOptions.find((model) => model.id === selectedModel)
      ?.supportsImageAttachments !== false
  )
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

  // insert a paragraph break before any title (**Title**\n)
  const normalizedText = text?.replace(
    /([^\n])(\*\*[^*\n]+\*\*\n)/g,
    '$1\n\n$2'
  )

  if (!normalizedText || normalizedText.trim().length === 0) {
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
        <div className="text-muted-foreground mb-2 border-l-2 border-slate-200 pl-3 text-sm">
          <Markdown
            content={normalizeCustomMathTags(normalizedText)}
            singleDollarTextMath
          />
        </div>
      ) : null}
    </div>
  )
}

export const Thread: FC<ThreadProps> = ({
  chatbotAvatar,
  chatbotFallbackIcon,
  chatbotName,
  contextLabel,
  contextualSuggestions,
  suggestions,
  welcomeMessage,
  capabilities,
  limitsNote,
  maxImageAttachments = MAX_IMAGE_ATTACHMENTS,
}) => {
  const { embedded } = useChatUi()
  const resolvedSuggestions =
    suggestions ??
    getStudentThreadSuggestions(contextualSuggestions ?? Boolean(contextLabel))

  return (
    <ThreadPrimitive.Root
      data-cy="chat-thread"
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
        <ThreadWelcome
          chatbotAvatar={chatbotAvatar}
          chatbotFallbackIcon={chatbotFallbackIcon}
          chatbotName={chatbotName}
          contextLabel={contextLabel}
          suggestions={resolvedSuggestions}
          welcomeMessage={welcomeMessage}
          capabilities={capabilities}
          limitsNote={limitsNote}
        />

        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessage,
            EditComposer: () => (
              <EditComposer maxImageAttachments={maxImageAttachments} />
            ),
            AssistantMessage: (props) => (
              <AssistantMessage
                {...props}
                chatbotAvatar={chatbotAvatar}
                chatbotFallbackIcon={chatbotFallbackIcon}
              />
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
        <Composer maxImageAttachments={maxImageAttachments} />
      </div>
    </ThreadPrimitive.Root>
  )
}

const ThreadScrollToBottom: FC = () => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ThreadPrimitive.ScrollToBottom asChild>
          <button className="absolute bottom-full mb-4 inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-full border border-gray-200 bg-gray-100/80 text-sm font-medium shadow-[0_0_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition-colors ease-in hover:border-gray-300 hover:bg-gray-200/80 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:invisible disabled:opacity-50">
            <ArrowDownIcon />
            <span className="sr-only">Scroll to bottom</span>
          </button>
        </ThreadPrimitive.ScrollToBottom>
      </TooltipTrigger>
    </Tooltip>
  )
}

const ThreadWelcome: FC<{
  chatbotAvatar: string
  chatbotFallbackIcon?: ComponentType<{ className?: string }>
  chatbotName: string
  contextLabel?: string | null
  suggestions: ThreadSuggestion[]
  welcomeMessage?: string
  capabilities?: ThreadWelcomeCapability[]
  limitsNote?: string
}> = ({
  chatbotAvatar,
  chatbotFallbackIcon,
  chatbotName,
  contextLabel,
  suggestions,
  welcomeMessage,
  capabilities,
  limitsNote,
}) => {
  const { embedded } = useChatUi()

  return (
    <ThreadPrimitive.Empty>
      <div
        className={twMerge(
          'flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col',
          embedded ? 'px-2' : ''
        )}
      >
        <div
          data-cy="chat-welcome-message"
          className="flex w-full flex-grow flex-col items-center justify-center py-8 text-center"
        >
          <ChatbotAvatar
            avatar={chatbotAvatar}
            fallbackIcon={chatbotFallbackIcon}
            className={twMerge(
              'text-uzh-blue border border-gray-200 bg-gray-50 shadow-sm',
              embedded ? 'size-14' : 'size-16'
            )}
            iconClassName={embedded ? 'size-6' : 'size-7'}
          />
          <p
            className={twMerge(
              'mt-4 font-semibold text-slate-900',
              embedded ? 'text-sm' : 'text-base'
            )}
          >
            {welcomeMessage ?? `Ask ${chatbotName}`}
          </p>
          {contextLabel && (
            <p className="text-muted-foreground mt-1 max-w-xs text-xs">
              {contextLabel}
            </p>
          )}
          {capabilities && capabilities.length > 0 && (
            <ThreadWelcomeCapabilities
              capabilities={capabilities}
              limitsNote={limitsNote}
            />
          )}
          <ThreadWelcomeSuggestions suggestions={suggestions} />
        </div>
      </div>
    </ThreadPrimitive.Empty>
  )
}

const ThreadWelcomeSuggestions: FC<{
  suggestions: ThreadSuggestion[]
}> = ({ suggestions }) => {
  const { embedded } = useChatUi()

  return (
    <div
      className={twMerge(
        'mt-5 grid w-full gap-2',
        embedded ? 'max-w-sm' : 'max-w-2xl sm:grid-cols-3'
      )}
    >
      {suggestions.map((suggestion) => (
        <ThreadPrimitive.Suggestion
          key={suggestion.id}
          className="hover:bg-muted/80 flex min-h-11 items-center justify-center rounded-md border bg-white px-3 py-2 text-center text-xs font-semibold text-slate-800 transition-colors ease-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          prompt={suggestion.prompt}
          method="replace"
          autoSend
        >
          {suggestion.text}
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  )
}

// Suggestions for the student/pwa assistant. The manage assistant derives its
// suggestions from the active manage surface instead (see
// `getManageSuggestions` in `@/src/lib/config/manageSuggestions`).
function getStudentThreadSuggestions(contextual: boolean): ThreadSuggestion[] {
  if (contextual) {
    return [
      {
        id: 'explain-question',
        text: 'Explain this question',
        prompt:
          'Explain the current question in simpler terms without revealing the answer.',
      },
      {
        id: 'small-hint',
        text: 'Give me a hint',
        prompt:
          'Give me a small hint for the current question without giving away the answer.',
      },
      {
        id: 'connect-concept',
        text: 'Connect the concept',
        prompt: 'How does the current question connect to the course material?',
      },
    ]
  }

  return [
    {
      id: 'explain-concept',
      text: 'Explain a concept',
      prompt: 'Explain a concept from this course.',
    },
    {
      id: 'study-help',
      text: 'Help me study',
      prompt: 'Help me review the current course topic.',
    },
    {
      id: 'practice-prompt',
      text: 'Practice prompt',
      prompt: 'Ask me a short practice question about the current topic.',
    },
  ]
}

const AttachmentErrorBanner: FC<{
  error: string | null
  onDismiss: () => void
  className?: string
}> = ({ error, onDismiss, className }) => {
  if (!error) return null
  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
        <span>{error}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded hover:bg-red-100"
          aria-label="Dismiss error"
        >
          <XIcon className="size-3" />
        </button>
      </div>
    </div>
  )
}

const Composer: FC<{ maxImageAttachments: number }> = ({
  maxImageAttachments,
}) => {
  const { embedded } = useChatUi()
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  return (
    <ComposerDropzone
      setError={setAttachmentError}
      maxImageAttachments={maxImageAttachments}
      className="w-full max-w-3xl"
      roundedClass="rounded-3xl"
    >
      <ComposerPrimitive.Root
        data-cy="chat-composer"
        className="flex w-full flex-col rounded-3xl border border-gray-200 bg-gray-100/80 px-2.5 shadow-[0_0_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition-colors ease-in focus-within:border-gray-300"
      >
        <ComposerAttachments />

        <AttachmentErrorBanner
          error={attachmentError}
          onDismiss={() => setAttachmentError(null)}
          className="px-2 pt-2"
        />

        <div className="flex w-full items-center">
          <ComposerAttachButton
            setError={setAttachmentError}
            maxImageAttachments={maxImageAttachments}
            dataCy="chat-composer"
          />
          <ComposerPrimitive.Input
            data-cy="chat-composer-input"
            rows={1}
            autoFocus={!embedded}
            placeholder="Write a message..."
            className={twMerge(
              'placeholder:text-muted-foreground text-md flex-grow cursor-text resize-none border-none bg-transparent px-2 outline-none focus:ring-0 disabled:cursor-not-allowed',
              embedded ? 'max-h-20 py-2' : 'max-h-40 py-4'
            )}
          />
          <ComposerAction />
        </div>
      </ComposerPrimitive.Root>
    </ComposerDropzone>
  )
}

const useComposerAttachmentLimit = ({
  setError,
  currentCount,
  maxImageAttachments,
}: {
  setError: (msg: string | null) => void
  currentCount?: number
  maxImageAttachments: number
}) => {
  const composerRuntime = useComposerRuntime()
  const attachments = useComposer((s) => s.attachments ?? [])
  const composerAttachmentCount = attachments.length
  const existingAttachmentCount =
    currentCount == null
      ? 0
      : Math.max(0, currentCount - composerAttachmentCount)
  const maxComposerAttachmentCount = Math.max(
    0,
    maxImageAttachments - existingAttachmentCount
  )

  useEffect(() => {
    if (attachments.length <= maxComposerAttachmentCount) return

    setError(attachmentLimitErrorMessage(maxImageAttachments))

    const overflowAttachmentIndexes = attachments
      .map((_, index) => index)
      .slice(maxComposerAttachmentCount)
      .reverse()

    void Promise.all(
      overflowAttachmentIndexes.map((index) =>
        composerRuntime.getAttachmentByIndex(index).remove()
      )
    )
  }, [
    attachments,
    composerRuntime,
    maxComposerAttachmentCount,
    maxImageAttachments,
    setError,
  ])
}

const ComposerDropzone: FC<
  PropsWithChildren<{
    setError: (msg: string | null) => void
    currentCount?: number
    maxImageAttachments: number
    className?: string
    roundedClass: string
  }>
> = ({
  setError,
  currentCount,
  maxImageAttachments,
  className,
  roundedClass,
  children,
}) => {
  const supportsImages = useSupportsImageAttachments()

  useComposerAttachmentLimit({
    setError,
    currentCount,
    maxImageAttachments,
  })

  return (
    <ComposerPrimitive.AttachmentDropzone
      data-testid="composer-dropzone"
      disabled={!supportsImages}
      className={twMerge(
        'group relative transition-colors data-[dragging]:ring-2 data-[dragging]:ring-slate-500',
        roundedClass,
        className
      )}
    >
      {children}
      {supportsImages && <ComposerDropOverlay roundedClass={roundedClass} />}
    </ComposerPrimitive.AttachmentDropzone>
  )
}

const ComposerDropOverlay: FC<{ roundedClass: string }> = ({
  roundedClass,
}) => (
  <div
    className={twMerge(
      'pointer-events-none absolute inset-0 z-10 hidden items-center justify-center border-2 border-dashed border-slate-500 bg-white/80 px-4 text-center text-sm font-medium text-slate-900 shadow-inner backdrop-blur-sm group-data-[dragging]:flex',
      roundedClass
    )}
  >
    Drop images to attach
  </div>
)

const ThreadComposerImageAttachment: FC = () => {
  const imageSrc = useThreadComposerAttachment(selectAttachmentImageSrc)
  const attachmentName = useThreadComposerAttachment(selectAttachmentName)
  return (
    <ComposerAttachmentView
      imageSrc={imageSrc}
      attachmentName={attachmentName}
    />
  )
}

const EditComposerImageAttachment: FC = () => {
  const imageSrc = useEditComposerAttachment(selectAttachmentImageSrc)
  const attachmentName = useEditComposerAttachment(selectAttachmentName)
  return (
    <ComposerAttachmentView
      imageSrc={imageSrc}
      attachmentName={attachmentName}
      variant="edit"
    />
  )
}

const ComposerAttachments: FC<{
  source?: 'thread' | 'edit'
  inline?: boolean
}> = ({ source = 'thread', inline = false }) => {
  const Component =
    source === 'edit'
      ? EditComposerImageAttachment
      : ThreadComposerImageAttachment
  const primitive = (
    <ComposerPrimitive.Attachments
      components={{
        Image: Component,
        Document: Component,
        File: Component,
        Attachment: Component,
      }}
    />
  )

  if (inline) {
    return <>{primitive}</>
  }

  return (
    <div className="flex w-full flex-wrap gap-2 py-2 empty:hidden">
      {primitive}
    </div>
  )
}

type AttachmentImagePart = {
  type: 'image'
  image: string
  imagePreview?: string
}

const isAttachmentImagePart = (part: unknown): part is AttachmentImagePart =>
  typeof part === 'object' &&
  part !== null &&
  'type' in part &&
  (part as { type: unknown }).type === 'image' &&
  'image' in part &&
  typeof (part as { image: unknown }).image === 'string'

type ComposerAttachmentLike = {
  name: string
  content?: readonly unknown[]
}

const selectAttachmentImageSrc = (
  attachment: ComposerAttachmentLike
): string | null => {
  const imagePart = attachment.content?.find(isAttachmentImagePart)
  return imagePart?.imagePreview ?? imagePart?.image ?? null
}

const selectAttachmentName = (attachment: ComposerAttachmentLike): string =>
  attachment.name

const AttachmentTile: FC<{
  imageSrc: string | null
  label: string
  sizeClasses: string
  children: ReactNode
}> = ({ imageSrc, label, sizeClasses, children }) => (
  <>
    {imageSrc ? (
      <img
        src={imageSrc}
        alt={label || 'Attachment preview'}
        className={twMerge('rounded-md border object-cover', sizeClasses)}
      />
    ) : (
      <div
        className={twMerge(
          'text-muted-foreground bg-muted flex items-center justify-center rounded-md border px-2 text-[10px]',
          sizeClasses
        )}
      >
        {label}
      </div>
    )}
    {children}
  </>
)

const AttachmentRemoveButton: FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    type="button"
    data-cy="chat-attachment-remove"
    onClick={onClick}
    className="bg-background text-muted-foreground hover:text-foreground absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full border"
    aria-label="Remove attachment"
  >
    ×
  </button>
)

const ComposerAttachmentView: FC<{
  imageSrc: string | null
  attachmentName: string
  variant?: 'thread' | 'edit'
}> = ({ imageSrc, attachmentName, variant = 'thread' }) => {
  const { embedded } = useChatUi()

  const sizeClasses =
    variant === 'edit'
      ? 'size-16 sm:size-20'
      : twMerge('size-14', embedded ? 'max-h-20 max-w-20' : 'max-h-28 max-w-28')

  return (
    <AttachmentPrimitive.Root
      data-cy="chat-composer-attachment"
      className="relative"
    >
      <AttachmentTile
        imageSrc={imageSrc}
        label={attachmentName}
        sizeClasses={sizeClasses}
      >
        <AttachmentPrimitive.Remove asChild>
          <AttachmentRemoveButton />
        </AttachmentPrimitive.Remove>
      </AttachmentTile>
    </AttachmentPrimitive.Root>
  )
}

const ComposerAttachButton: FC<{
  setError: (msg: string | null) => void
  currentCount?: number
  maxImageAttachments: number
  dataCy?: string
}> = ({ setError, currentCount, maxImageAttachments, dataCy }) => {
  const { embedded } = useChatUi()
  const composerRuntime = useComposerRuntime()
  const composerAttachmentCount = useComposer((s) => s.attachments?.length ?? 0)
  const attachmentCount = currentCount ?? composerAttachmentCount
  const inputRef = useRef<HTMLInputElement | null>(null)
  const supportsImages = useSupportsImageAttachments()

  if (!supportsImages || attachmentCount >= maxImageAttachments) return null

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const remaining = Math.max(0, maxImageAttachments - attachmentCount)
    const accepted = Array.from(files).slice(0, remaining)
    const rejectedCount = files.length - accepted.length

    setError(null)

    let lastAdapterError: string | null = null
    for (const file of accepted) {
      try {
        await composerRuntime.addAttachment(file)
      } catch (e) {
        lastAdapterError = e instanceof Error ? e.message : String(e)
      }
    }

    if (rejectedCount > 0) {
      setError(attachmentLimitErrorMessage(maxImageAttachments))
    } else if (lastAdapterError) {
      setError(lastAdapterError)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        data-cy={dataCy + '-attach-input' || 'chat-attach-input'}
        type="file"
        accept={imageAttachmentAdapter.accept}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          void handleFiles(files)
          // reset so selecting the same file twice still triggers change
          event.target.value = ''
        }}
      />
      <button
        type="button"
        data-cy={dataCy + '-attach-button' || 'chat-attach-button'}
        onClick={() => inputRef.current?.click()}
        className={twMerge(
          'text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-md',
          embedded ? 'size-11' : 'size-9'
        )}
        aria-label="Attach image"
      >
        <ImagePlusIcon className={embedded ? 'size-4' : 'size-5'} />
      </button>
    </>
  )
}

const ComposerAction: FC = () => {
  const { embedded } = useChatUi()
  const isEmpty = useComposer((s) => s.isEmpty)
  const size = embedded ? '44px' : '36px'

  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <Button
            basic
            data-cy="chat-send-button"
            style={{
              width: size,
              height: size,
              minWidth: size,
              minHeight: size,
              padding: '0',
              color: isEmpty ? 'var(--muted-foreground)' : 'black',
            }}
            className={{
              root: twMerge(
                'flex items-center justify-center rounded-md transition-colors',
                embedded ? 'm-0' : 'm-2',
                !isEmpty && 'hover:bg-accent'
              ),
            }}
          >
            <SendHorizontalIcon className={embedded ? 'size-4' : 'size-5'} />
          </Button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            basic
            data-cy="chat-cancel-button"
            style={{
              width: size,
              height: size,
              minWidth: size,
              minHeight: size,
              padding: '0',
              color: 'black',
            }}
            className={{
              root: twMerge(
                'hover:bg-accent flex items-center justify-center rounded-md transition-colors',
                embedded ? 'm-0' : 'm-2'
              ),
            }}
          >
            <SquareIcon className={embedded ? 'size-4' : 'size-5'} />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  )
}

const getMessageAttachments = (
  message: MessageWithCustomMetadata
): ImageAttachment[] => {
  const direct = message.imageAttachments
  if (Array.isArray(direct) && direct.length > 0) return direct
  const fromMeta = message.metadata?.custom?.imageAttachments
  if (Array.isArray(fromMeta) && fromMeta.length > 0) return fromMeta
  return []
}

const UserMessage: FC = () => {
  const message = useMessage() as MessageWithCustomMetadata
  const attachments = getMessageAttachments(message)

  return (
    <MessagePrimitive.Root
      data-cy="chat-user-message"
      className="flex w-full max-w-[var(--thread-max-width)] flex-col items-end gap-y-1 py-2 sm:py-4"
    >
      <div
        data-cy="chat-user-message-content"
        className="bg-muted text-foreground max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-2xl px-5 py-2.5"
      >
        {attachments.length > 0 && (
          <MessageAttachments
            attachments={attachments}
            messageId={message.id}
            hydrationSourceMessageId={message.attachmentSourceMessageId}
            className="mb-2"
          />
        )}
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
  const message = useMessage() as MessageWithCustomMetadata
  const supportsImages = useSupportsImageAttachments()

  if (!showMessageActions) return null

  const attachments = getMessageAttachments(message)
  const hasImages = hasAnyImageAttachmentData(attachments)
  const editDisabled = hasImages && !supportsImages

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
              <button
                data-cy="chat-edit-message-button"
                className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
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

const EditComposer: FC<{ maxImageAttachments: number }> = ({
  maxImageAttachments,
}) => {
  const { showMessageActions } = useChatUi()
  const message = useMessage() as MessageWithCustomMetadata
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const attachments = getMessageAttachments(message)
  const removedAttachmentKeys = useComposerStore(
    (state) =>
      state.editRemovedAttachmentKeysByMessageId[message.id] ??
      EMPTY_REMOVED_ATTACHMENT_KEYS
  )
  const addEditRemovedAttachmentKey = useComposerStore(
    (state) => state.addEditRemovedAttachmentKey
  )
  const clearEditRemovedAttachmentKeys = useComposerStore(
    (state) => state.clearEditRemovedAttachmentKeys
  )
  const pendingAttachmentCount = useComposer((s) => s.attachments?.length ?? 0)
  const composerText = useEditComposer((s) => s.text)
  const originalText = extractMessageText(message)
  const threadRuntime = useThreadRuntime()
  const messageRuntime = useMessageRuntime()

  useEffect(() => {
    return () => {
      clearEditRemovedAttachmentKeys(message.id)
    }
  }, [clearEditRemovedAttachmentKeys, message.id])

  if (!showMessageActions) return null

  const removedAttachmentKeySet = new Set(removedAttachmentKeys)
  const attachmentEntries = attachments.map((attachment, index) => ({
    attachment,
    key: getImageAttachmentKey(attachment, index),
  }))
  const visibleAttachmentEntries = attachmentEntries.filter(
    ({ key }) => !removedAttachmentKeySet.has(key)
  )
  const totalAttachmentCount =
    visibleAttachmentEntries.length + pendingAttachmentCount

  // require text or attachment change to enable send
  const textChanged = composerText !== originalText
  const attachmentsChanged =
    pendingAttachmentCount > 0 ||
    attachmentEntries.length !== visibleAttachmentEntries.length
  const canSubmit =
    composerText.trim().length + totalAttachmentCount > 0 &&
    (textChanged || attachmentsChanged)

  const handleSend = async () => {
    if (!canSubmit) return

    try {
      const editComposer = messageRuntime.composer
      const state = editComposer.getState()
      const completeAttachments = await Promise.all(
        state.attachments.map(async (attachment) =>
          attachment.status?.type === 'complete'
            ? attachment
            : await imageAttachmentAdapter.send(attachment as never)
        )
      )

      threadRuntime.append({
        role: 'user',
        content: [{ type: 'text', text: composerText }],
        attachments: completeAttachments as never,
        parentId: message.parentId ?? undefined,
        sourceId: message.id,
      })
      editComposer.cancel()
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <ComposerDropzone
      setError={setAttachmentError}
      currentCount={totalAttachmentCount}
      maxImageAttachments={maxImageAttachments}
      className="my-4 w-full max-w-[var(--thread-max-width)]"
      roundedClass="rounded-2xl"
    >
      <ComposerPrimitive.Root
        data-cy="chat-edit-composer"
        className="bg-muted flex w-full flex-col gap-2 rounded-2xl border-none outline-none focus-within:outline-none focus-within:ring-0"
      >
        <ComposerPrimitive.Input
          data-cy="chat-edit-composer-input"
          autoFocus
          className="text-foreground flex min-h-[2.5rem] w-full resize-none border-0 bg-transparent px-4 pt-4 outline-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
        />

        <AttachmentErrorBanner
          error={attachmentError}
          onDismiss={() => setAttachmentError(null)}
          className="px-4"
        />

        <div className="mx-4 mb-2 flex items-end gap-2 pb-2">
          {(visibleAttachmentEntries.length > 0 ||
            pendingAttachmentCount > 0) && (
            <div className="flex flex-wrap gap-2">
              {visibleAttachmentEntries.map(({ attachment, key }) => {
                const previewSrc = getAttachmentPreviewSrc(attachment, 'edit')
                const label =
                  attachment.imageDescription?.trim() || 'Attachment'

                return (
                  <div key={key} className="relative">
                    <AttachmentTile
                      imageSrc={previewSrc ?? null}
                      label={label}
                      sizeClasses="size-16 sm:size-20"
                    >
                      <AttachmentRemoveButton
                        onClick={() =>
                          addEditRemovedAttachmentKey(message.id, key)
                        }
                      />
                    </AttachmentTile>
                  </div>
                )
              })}
              <ComposerAttachments source="edit" inline />
            </div>
          )}
          <ComposerAttachButton
            setError={setAttachmentError}
            currentCount={totalAttachmentCount}
            maxImageAttachments={maxImageAttachments}
            dataCy="chat-edit-composer"
          />
          <div className="ml-auto flex items-center justify-center gap-2">
            <Button
              data-cy="chat-edit-cancel-button"
              onClick={() => {
                clearEditRemovedAttachmentKeys(message.id)
                messageRuntime.composer.cancel()
              }}
              style={{
                backgroundColor: '#000000',
                color: '#ffffff',
              }}
              className={{
                root: 'rounded-full font-semibold hover:!bg-gray-800',
              }}
            >
              <Button.Label>Cancel</Button.Label>
            </Button>
            <Button
              data-cy="chat-edit-send-button"
              onClick={() => void handleSend()}
              disabled={!canSubmit}
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
              }}
              className={{
                root: 'rounded-full font-semibold hover:!bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50',
              }}
            >
              <Button.Label>Send</Button.Label>
            </Button>
          </div>
        </div>
      </ComposerPrimitive.Root>
    </ComposerDropzone>
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

// A failed assistant turn (mid-stream provider error, or a stream that never
// produced any content at all) leaves the message in
// status: {type: "incomplete", reason: "error"}. MessagePrimitive.Error only
// renders its children for that exact state, so this note stays invisible
// for every other message. Deliberately minimal: a muted inline note, no
// retry button (the composer already accepts a new message) and no toast.
// The raw SDK error text is not shown here — it can contain internal details
// (e.g. a JSON parse error) that are not meant for end users.
const AssistantMessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root
      data-cy="chat-assistant-message-error"
      className="mt-1.5 inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs text-red-600"
    >
      <ErrorPrimitive.Message>
        Something went wrong. Please try again.
      </ErrorPrimitive.Message>
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
)

const AssistantMessage: FC<{
  chatbotAvatar: string
  chatbotFallbackIcon?: ComponentType<{ className?: string }>
}> = ({ chatbotAvatar, chatbotFallbackIcon }) => {
  const { embedded } = useChatUi()

  return (
    <MessagePrimitive.Root
      data-cy="chat-assistant-message"
      className={twMerge(
        'relative grid w-full max-w-[var(--thread-max-width)] grid-rows-[auto_1fr] py-2 sm:py-4',
        embedded ? 'grid-cols-[auto_1fr] gap-x-2' : 'grid-cols-[auto_auto_1fr]'
      )}
    >
      <div
        className={twMerge(
          'col-start-1 row-span-2 row-start-1 flex items-start',
          embedded ? 'mt-2' : 'mr-2 mt-2 pr-1 sm:mr-3 sm:mt-3 sm:pr-2'
        )}
      >
        <ChatbotAvatar
          avatar={chatbotAvatar}
          fallbackIcon={chatbotFallbackIcon}
          className={twMerge(
            'text-uzh-blue border border-gray-200 bg-white',
            embedded ? 'size-7' : 'size-6 sm:size-9'
          )}
          iconClassName={embedded ? 'size-3.5' : 'size-4'}
        />
      </div>
      <div
        data-cy="chat-assistant-message-content"
        className={twMerge(
          'text-foreground row-start-1 my-1.5 break-words leading-7',
          embedded
            ? 'col-start-2 max-w-full text-sm leading-6'
            : 'col-span-2 col-start-2 max-w-[calc(var(--thread-max-width)*0.8)]'
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
        <AssistantMessageError />
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
              <button
                data-cy="chat-copy-message-button"
                className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
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
              <button
                data-cy="chat-reload-message-button"
                className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
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
