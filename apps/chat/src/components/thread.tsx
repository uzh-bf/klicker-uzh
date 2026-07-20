import { imageAttachmentAdapter } from '@/src/lib/attachments/imageAttachmentAdapter'
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  ComposerPrimitive,
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
import {
  MAX_IMAGE_ATTACHMENTS,
  useComposerStore,
} from '@/src/stores/composerStore'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { Button } from '@uzh-bf/design-system'
import { BranchPicker } from './branch-picker'
import { useChatUi } from './chat-ui-context'
import { MessageAttachments } from './message-attachments'
import { ToolFallback } from './tool-fallback'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

import Image from 'next/image'

import { Markdown } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

type ThreadProps = { chatbotAvatar: string }
const EMPTY_REMOVED_ATTACHMENT_KEYS: string[] = []

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
  const t = useTranslations()

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
    parts.push(
      t('chat.message.creditsUsed', { credits: formatCredits(creditsUsed) })
    )
  }

  if (parts.length === 0) return null

  return (
    <div className="text-muted-foreground mt-1 text-xs">
      {parts.join(' — ')}
    </div>
  )
}

const AssistantReasoningPart: FC<ReasoningMessagePartProps> = ({ text }) => {
  const t = useTranslations()
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
        {t('chat.message.reasoningToggle')}
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

export const Thread: FC<ThreadProps> = ({ chatbotAvatar }) => {
  const { embedded } = useChatUi()

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
  const t = useTranslations()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ThreadPrimitive.ScrollToBottom asChild>
          <button className="absolute bottom-full mb-4 inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-full border border-gray-200 bg-gray-100/80 text-sm font-medium shadow-[0_0_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition-colors ease-in hover:border-gray-300 hover:bg-gray-200/80 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:invisible disabled:opacity-50">
            <ArrowDownIcon />
            <span className="sr-only">{t('chat.thread.scrollToBottom')}</span>
          </button>
        </ThreadPrimitive.ScrollToBottom>
      </TooltipTrigger>
    </Tooltip>
  )
}

const ThreadWelcome: FC = () => {
  const t = useTranslations()
  return (
    <ThreadPrimitive.Empty>
      <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="aui-thread-welcome-center flex w-full flex-grow flex-col items-center justify-center">
          <div
            data-cy="chat-welcome-message"
            className="aui-thread-welcome-message flex size-full flex-col items-center justify-center px-8 text-center"
          >
            <div className="aui-thread-welcome-message-motion-1 text-2xl font-semibold">
              {t('chat.thread.welcomeTitle')}
            </div>
            <div className="aui-thread-welcome-message-motion-2 text-muted-foreground/65 text-2xl">
              {t('chat.thread.welcomeSubtitle')}
            </div>
          </div>
        </div>
        {/* <ThreadWelcomeSuggestions />  */}
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

const AttachmentErrorBanner: FC<{
  error: string | null
  onDismiss: () => void
  className?: string
}> = ({ error, onDismiss, className }) => {
  const t = useTranslations()
  if (!error) return null
  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
        <span>{error}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded hover:bg-red-100"
          aria-label={t('chat.composer.dismissError')}
        >
          <XIcon className="size-3" />
        </button>
      </div>
    </div>
  )
}

const Composer: FC = () => {
  const t = useTranslations()
  const { embedded } = useChatUi()
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  return (
    <ComposerDropzone
      setError={setAttachmentError}
      className="w-full max-w-3xl"
      roundedClass="rounded-3xl"
    >
      <ComposerPrimitive.Root
        data-cy="chat-composer"
        className="focus-within:border-primary/40 focus-within:ring-primary/10 flex w-full flex-col rounded-3xl border border-gray-200 bg-white px-2.5 shadow-[0_0_12px_rgba(0,0,0,0.06)] transition-colors ease-in focus-within:ring-2"
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
            dataCy="chat-composer"
          />
          <ComposerPrimitive.Input
            data-cy="chat-composer-input"
            rows={1}
            autoFocus
            placeholder={t('chat.composer.placeholder')}
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
}: {
  setError: (msg: string | null) => void
  currentCount?: number
}) => {
  const t = useTranslations()
  const composerRuntime = useComposerRuntime()
  const attachments = useComposer((s) => s.attachments ?? [])
  const composerAttachmentCount = attachments.length
  const existingAttachmentCount =
    currentCount == null
      ? 0
      : Math.max(0, currentCount - composerAttachmentCount)
  const maxComposerAttachmentCount = Math.max(
    0,
    MAX_IMAGE_ATTACHMENTS - existingAttachmentCount
  )

  useEffect(() => {
    if (attachments.length <= maxComposerAttachmentCount) return

    setError(
      t('chat.composer.attachmentLimitError', { max: MAX_IMAGE_ATTACHMENTS })
    )

    const overflowAttachmentIndexes = attachments
      .map((_, index) => index)
      .slice(maxComposerAttachmentCount)
      .reverse()

    void Promise.all(
      overflowAttachmentIndexes.map((index) =>
        composerRuntime.getAttachmentByIndex(index).remove()
      )
    )
  }, [attachments, composerRuntime, maxComposerAttachmentCount, setError, t])
}

const ComposerDropzone: FC<
  PropsWithChildren<{
    setError: (msg: string | null) => void
    currentCount?: number
    className?: string
    roundedClass: string
  }>
> = ({ setError, currentCount, className, roundedClass, children }) => {
  const supportsImages = useSupportsImageAttachments()

  useComposerAttachmentLimit({ setError, currentCount })

  return (
    <ComposerPrimitive.AttachmentDropzone
      data-testid="composer-dropzone"
      disabled={!supportsImages}
      className={twMerge(
        'data-[dragging]:ring-primary/40 group relative transition-colors data-[dragging]:ring-2',
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
}) => {
  const t = useTranslations()
  return (
    <div
      className={twMerge(
        'border-primary/60 text-primary pointer-events-none absolute inset-0 z-10 hidden items-center justify-center border-2 border-dashed bg-white/85 px-4 text-center text-sm font-medium shadow-inner backdrop-blur-sm group-data-[dragging]:flex',
        roundedClass
      )}
    >
      {t('chat.composer.dropImages')}
    </div>
  )
}

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
}> = ({ imageSrc, label, sizeClasses, children }) => {
  const t = useTranslations()
  return (
    <>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={label || t('chat.composer.attachmentPreviewAlt')}
          className={twMerge('rounded-lg border object-cover', sizeClasses)}
        />
      ) : (
        <div
          className={twMerge(
            'text-muted-foreground bg-muted flex items-center justify-center rounded-lg border px-2 text-[10px]',
            sizeClasses
          )}
        >
          {label}
        </div>
      )}
      {children}
    </>
  )
}

const AttachmentRemoveButton: FC<{ onClick?: () => void }> = ({ onClick }) => {
  const t = useTranslations()
  return (
    <button
      type="button"
      data-cy="chat-attachment-remove"
      onClick={onClick}
      className="bg-background text-muted-foreground hover:text-foreground absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full border"
      aria-label={t('chat.composer.removeAttachment')}
    >
      ×
    </button>
  )
}

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
  dataCy?: string
}> = ({ setError, currentCount, dataCy }) => {
  const t = useTranslations()
  const { embedded } = useChatUi()
  const composerRuntime = useComposerRuntime()
  const composerAttachmentCount = useComposer((s) => s.attachments?.length ?? 0)
  const attachmentCount = currentCount ?? composerAttachmentCount
  const inputRef = useRef<HTMLInputElement | null>(null)
  const supportsImages = useSupportsImageAttachments()

  if (!supportsImages || attachmentCount >= MAX_IMAGE_ATTACHMENTS) return null

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const remaining = Math.max(0, MAX_IMAGE_ATTACHMENTS - attachmentCount)
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
      setError(
        t('chat.composer.attachmentLimitError', { max: MAX_IMAGE_ATTACHMENTS })
      )
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
          embedded ? 'size-7' : 'size-9'
        )}
        aria-label={t('chat.composer.attachImage')}
      >
        <ImagePlusIcon className={embedded ? 'size-4' : 'size-5'} />
      </button>
    </>
  )
}

const ComposerAction: FC = () => {
  const { embedded } = useChatUi()
  // Shared shape/focus for both action buttons; the design-system `Button`'s
  // focus ring is lost when swapping to a plain <button> (see Send note below),
  // so restore an equivalent `focus-visible` ring here.
  const baseAction = twMerge(
    'focus-visible:ring-ring flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed',
    embedded ? 'm-1' : 'm-2',
    embedded ? 'size-7' : 'size-9'
  )

  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          {/*
           * Plain button, not the design-system `Button`: the `Send asChild`
           * Slot merges a className *string*, which clobbers `Button`'s object
           * `className.root`. A raw <button> takes the class string cleanly, so
           * the `bg-primary` fill and `disabled:` (empty-composer) states apply.
           */}
          <button
            type="button"
            data-cy="chat-send-button"
            className={twMerge(
              baseAction,
              'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
              'disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none'
            )}
          >
            <SendHorizontalIcon className={embedded ? 'size-4' : 'size-5'} />
          </button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <button
            type="button"
            data-cy="chat-cancel-button"
            className={twMerge(
              baseAction,
              'text-foreground hover:bg-accent disabled:opacity-50'
            )}
          >
            <SquareIcon className={embedded ? 'size-4' : 'size-5'} />
          </button>
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
  const t = useTranslations()
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
              <span className="sr-only">
                {t('chat.message.editUnavailable')}
              </span>
            </button>
          ) : (
            <ActionBarPrimitive.Edit asChild>
              <button
                data-cy="chat-edit-message-button"
                className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
                <PencilIcon />
                <span className="sr-only">{t('chat.message.edit')}</span>
              </button>
            </ActionBarPrimitive.Edit>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {editDisabled
            ? t('chat.message.editDisabledTooltip')
            : t('chat.message.edit')}
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
              <span className="sr-only">{t('chat.message.copy')}</span>
            </button>
          </ActionBarPrimitive.Copy>
        </TooltipTrigger>
        <TooltipContent>{t('chat.message.copy')}</TooltipContent>
      </Tooltip>

      <BranchPickerWrapper />
    </ActionBarPrimitive.Root>
  )
}

const EditComposer: FC = () => {
  const t = useTranslations()
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
                  attachment.imageDescription?.trim() ||
                  t('chat.composer.attachmentFallbackLabel')

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
              <Button.Label>{t('chat.composer.editCancel')}</Button.Label>
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
              <Button.Label>{t('chat.composer.editSend')}</Button.Label>
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
  const t = useTranslations()
  const [isOpen, setIsOpen] = useState(false)

  if (!groupKey || indices.length <= 1) {
    return <>{children}</>
  }

  const label =
    groupKey === 'reasoning'
      ? t('chat.message.reasoningGroupLabel', { count: indices.length })
      : t('chat.message.toolCallsGroupLabel', { count: indices.length })

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
      data-cy="chat-assistant-message"
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
        data-cy="chat-assistant-message-content"
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
  const t = useTranslations()
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
                <span className="sr-only">{t('chat.message.copy')}</span>
              </button>
            </ActionBarPrimitive.Copy>
          </TooltipTrigger>
          <TooltipContent>{t('chat.message.copy')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ActionBarPrimitive.Reload asChild>
              <button
                data-cy="chat-reload-message-button"
                className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
                <RefreshCwIcon />
                <span className="sr-only">{t('chat.message.refresh')}</span>
              </button>
            </ActionBarPrimitive.Reload>
          </TooltipTrigger>
          <TooltipContent>{t('chat.message.refresh')}</TooltipContent>
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
