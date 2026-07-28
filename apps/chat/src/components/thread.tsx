import { imageAttachmentAdapter } from '@/src/lib/attachments/imageAttachmentAdapter'
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useComposer,
  useComposerRuntime,
  useEditComposer,
  useEditComposerAttachment,
  useMessage,
  useMessageRuntime,
  useThread,
  useThreadComposerAttachment,
} from '@assistant-ui/react'
import {
  ArrowDownIcon,
  CheckIcon,
  CopyIcon,
  ImageIcon,
  ImagePlusIcon,
  PencilIcon,
  PencilOffIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from 'lucide-react'
import {
  type FC,
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

import { useMessageSources } from '@/src/hooks/useMessageSources'
import {
  getImageAttachmentKey,
  hasAnyImageAttachmentData,
  parentMessageHasImageAttachment,
} from '@/src/lib/attachments/attachmentState'
import { getAttachmentPreviewSrc } from '@/src/lib/attachments/attachmentUi'
import {
  type ExtendedThreadMessageLike,
  useChatStore,
} from '@/src/stores/chatStore'
import {
  MAX_IMAGE_ATTACHMENTS,
  useComposerStore,
} from '@/src/stores/composerStore'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { Button } from '@uzh-bf/design-system'
import { isKnownMode } from '../lib/config/modes'
import { formatReasoningEffort } from '../lib/config/reasoning'
import { getThreadSuggestions } from '../lib/config/suggestions'
import { BranchPicker } from './branch-picker'
import { useChatUi } from './chat-ui-context'
import { MessageAttachments } from './message-attachments'
import { AssistantMessageParts } from './message-parts'
import { MessageSourcesProvider } from './message-sources-context'
import { SourcesSection } from './sources-section'
import { actionBarButtonClassName } from './ui/action-bar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

import Image from 'next/image'
import { useParams } from 'next/navigation'

import { useFormatter, useNow, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

type ThreadProps = { chatbotAvatar: string }
const EMPTY_REMOVED_ATTACHMENT_KEYS: string[] = []
const EMPTY_MESSAGES: ExtendedThreadMessageLike[] = []

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
    // `useMessage()` already returns `createdAt` at runtime (assistant-ui's
    // `ThreadMessage`); declared here only to widen the local cast, like
    // `role`/`status` above.
    createdAt: Date
  }
  const { modelOptions } = useSettingsStore()
  const t = useTranslations()
  const format = useFormatter()
  // A ticking `now`, not `new Date()`: the caption is rendered once and its
  // message only re-renders on its own state changes (a vote, an edit, a branch
  // switch), so a fixed `now` would freeze an answer at "less than a minute
  // ago" for as long as the student reads it. Passing `now` at all is also what
  // keeps next-intl from logging an ENVIRONMENT_FALLBACK error every render.
  const now = useNow({ updateInterval: 60_000 })

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

  // Same label the mode switcher shows, so the caption under an answer does not
  // read "Explainer" in German while the live pill reads "Erklärer". Unknown
  // per-chatbot keys have no translation and keep their raw name.
  const modeLabel = !chatMode
    ? null
    : isKnownMode(chatMode)
      ? t(`chat.modes.${chatMode}`)
      : formatTitleCase(chatMode)
  const modelLabel = modelId
    ? modelOptions.find((option) => option.id === modelId)?.name || modelId
    : null
  const reasoningLabel = reasoningEffort
    ? formatReasoningEffort(t, reasoningEffort)
    : null
  const creditsLabel =
    includeCredits && typeof creditsUsed === 'number'
      ? // `count` selects the plural form and must be read off the
        // *displayed* value: a raw 1.2 renders as "1" but plural-selects as
        // `other`, so passing it through unrounded prints "1 credits".
        t('chat.message.creditsUsed', {
          count: Number(formatCredits(creditsUsed)),
          credits: formatCredits(creditsUsed),
        })
      : null

  // V6: the raw model id/name is dropped from the always-visible caption to
  // keep it terse — it still lives in the `title` tooltip below (hover to
  // reveal the full detail, including the model).
  const visibleParts = [modeLabel, reasoningLabel, creditsLabel].filter(Boolean)
  const fullParts = [
    modeLabel,
    modelLabel,
    reasoningLabel,
    creditsLabel,
  ].filter(Boolean)
  const hasCustomMetadata = fullParts.length > 0

  // Relative send time. `title` sits on the <time> so hovering it shows the
  // absolute date, while hovering the rest of the caption still shows the full
  // mode/model/reasoning/credits detail. It renders plain (no sr-only /
  // aria-hidden split) because there is only one version of this text.
  const absoluteTimestamp = format.dateTime(message.createdAt, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const timestamp = (
    <time dateTime={message.createdAt.toISOString()} title={absoluteTimestamp}>
      {format.relativeTime(message.createdAt, now)}
    </time>
  )

  // The `title` tooltip is mouse-only; the sr-only copy keeps the full detail
  // (incl. model) reachable for screen readers. The timestamp always renders,
  // so this caption is never empty even with no custom metadata at all.
  //
  // The trailing separator hangs off each metadata span rather than sitting in
  // its own: `visibleParts` can be empty while `fullParts` is not — an answer
  // carrying only a model id, from a chatbot with no modes, a non-reasoning
  // model and credits off — and a standalone separator would then render the
  // caption as a dangling "— 5 minutes ago".
  return (
    <div
      className="text-foreground mt-1 text-xs"
      title={hasCustomMetadata ? fullParts.join(' — ') : undefined}
    >
      {hasCustomMetadata && (
        <>
          {visibleParts.length > 0 && (
            <span aria-hidden="true">{visibleParts.join(' — ')} — </span>
          )}
          <span className="sr-only">{fullParts.join(' — ')} — </span>
        </>
      )}
      {timestamp}
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
        <ThreadWelcome chatbotAvatar={chatbotAvatar} />

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
          embedded
            ? 'px-2 pb-2'
            : 'px-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4'
        )}
      >
        <div className="from-background bg-linear-to-t pointer-events-none absolute inset-x-0 bottom-full h-12 to-transparent" />
        {!embedded && <ThreadScrollToBottom />}
        <Composer />
        {/* S6: standalone-only, same as ThreadScrollToBottom above — an
            embedded widget has little vertical room and the embedding page
            already carries the disclaimer context. */}
        {!embedded && <ComposerHint />}
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
          <button className="border-border bg-background/80 hover:bg-accent absolute bottom-full mb-4 inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-full border text-sm font-medium shadow-[0_0_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition-[opacity,color,background-color] duration-200 ease-in focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:invisible disabled:opacity-0 disabled:[transition:opacity_200ms,visibility_0s_200ms] motion-reduce:transition-none">
            <ArrowDownIcon />
            <span className="sr-only">{t('chat.thread.scrollToBottom')}</span>
          </button>
        </ThreadPrimitive.ScrollToBottom>
      </TooltipTrigger>
    </Tooltip>
  )
}

// Pulsing-dot treatment for the pending assistant turn. The external-store
// runtime injects a synthetic empty assistant message as soon as `isRunning`
// flips true (before `useChatResponse` streams its first part), so the
// indicator renders inside that message's content area — the row itself
// already exists, meaning nothing jumps when real content replaces the dots.
const THINKING_DOT_DELAYS = [
  '[animation-delay:0ms]',
  '[animation-delay:150ms]',
  '[animation-delay:300ms]',
]

const ThinkingDots: FC = () => {
  const t = useTranslations()
  return (
    <div
      data-cy="chat-thinking-indicator"
      role="status"
      className="flex min-h-7 items-center gap-1 py-2"
    >
      {THINKING_DOT_DELAYS.map((delayClassName, index) => (
        <span
          key={index}
          className={twMerge(
            'bg-muted-foreground/40 size-1.5 animate-[pulse_1s_ease-in-out_infinite] rounded-full motion-reduce:animate-none',
            delayClassName
          )}
        />
      ))}
      <span className="sr-only">{t('chat.thread.thinking')}</span>
    </div>
  )
}

const ThreadWelcome: FC<{ chatbotAvatar: string }> = ({ chatbotAvatar }) => {
  const t = useTranslations()
  return (
    <ThreadPrimitive.Empty>
      <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="aui-thread-welcome-center relative flex w-full flex-grow flex-col items-center justify-center">
          {/* Faint branded accent behind the greeting — restrained, no new assets. */}
          <div
            aria-hidden
            className="bg-primary/5 pointer-events-none absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          />
          <div
            data-cy="chat-welcome-message"
            className="aui-thread-welcome-message relative flex size-full flex-col items-center justify-center px-8 text-center"
          >
            {chatbotAvatar && (
              <Image
                src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${chatbotAvatar}.svg`}
                alt=""
                width={56}
                height={56}
                unoptimized
                className="ring-border animate-in fade-in slide-in-from-bottom-2 mb-4 rounded-full bg-white ring-1 duration-300 motion-reduce:animate-none"
              />
            )}
            <div className="animate-in fade-in slide-in-from-bottom-2 text-3xl font-semibold duration-300 motion-reduce:animate-none sm:text-4xl">
              {t('chat.thread.welcomeTitle')}
            </div>
            <div className="text-muted-foreground animate-in fade-in slide-in-from-bottom-2 text-lg delay-100 duration-300 motion-reduce:animate-none">
              {t('chat.thread.welcomeSubtitle')}
            </div>
          </div>
        </div>
        <ThreadWelcomeSuggestions />
      </div>
    </ThreadPrimitive.Empty>
  )
}

const SUGGESTION_DELAY_CLASSNAMES = ['delay-150', 'delay-200']

const ThreadWelcomeSuggestions: FC = () => {
  const t = useTranslations()
  const suggestions = getThreadSuggestions()

  return (
    <div className="mt-4 grid w-full grid-cols-1 gap-3 px-8 sm:grid-cols-2">
      {suggestions.map((suggestion, index) => (
        <ThreadPrimitive.Suggestion
          key={suggestion.id}
          data-cy="chat-welcome-suggestion"
          className={twMerge(
            'border-border bg-background hover:bg-accent animate-in fade-in slide-in-from-bottom-2 min-h-11 rounded-lg border p-3 text-left text-sm transition-colors duration-300 motion-reduce:animate-none',
            SUGGESTION_DELAY_CLASSNAMES[index] ?? 'delay-200'
          )}
          prompt={t(`chat.suggestions.${suggestion.id}Prompt`)}
          autoSend
        >
          {t(`chat.suggestions.${suggestion.id}`)}
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  )
}

const AttachmentErrorBanner: FC<{
  error: string | null
  onDismiss: () => void
  className?: string
}> = ({ error, onDismiss, className }) => {
  const t = useTranslations()
  if (!error) return null
  return (
    <div className={className}>
      <div className="bg-destructive/10 text-destructive inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs">
        <span>{error}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="hover:bg-destructive/20 rounded"
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
        className="focus-within:border-primary/40 focus-within:ring-primary/10 bg-background border-border flex w-full flex-col rounded-3xl border px-2.5 shadow-[0_0_12px_rgba(0,0,0,0.06)] transition-colors ease-in focus-within:ring-2"
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
              'placeholder:text-muted-foreground flex-grow cursor-text resize-none border-none bg-transparent px-2 text-base outline-none focus:ring-0 disabled:cursor-not-allowed',
              embedded ? 'max-h-20 py-2' : 'max-h-40 py-4'
            )}
          />
          <ComposerAction />
        </div>
      </ComposerPrimitive.Root>
    </ComposerDropzone>
  )
}

// Deliberately carries only the accuracy caveat. A per-message credit cost
// belongs nowhere near here: `calcCost` in the chat route prices each answer
// from input/output tokens, so the figure varies by model and exchange length —
// which is exactly what `chat.credits.costHint` already says, in the credits
// surfaces that can also show the balance it applies to.
const ComposerHint: FC = () => {
  const t = useTranslations()

  return (
    <p
      data-cy="chat-composer-hint"
      className="text-muted-foreground mt-1.5 w-full max-w-3xl px-2 text-center text-xs"
    >
      {t('chat.composer.disclaimerHint')}
    </p>
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
        'border-primary/60 text-primary bg-background/85 pointer-events-none absolute inset-0 z-10 hidden items-center justify-center border-2 border-dashed px-4 text-center text-sm font-medium shadow-inner backdrop-blur-sm group-data-[dragging]:flex',
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
            'text-foreground bg-muted flex items-center justify-center rounded-lg border px-2 text-[10px]',
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
      className="bg-background text-muted-foreground hover:text-foreground absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full border"
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
  const t = useTranslations()
  const { embedded } = useChatUi()
  // M6: a single persistent circular shell — both buttons always mount and
  // stack in the same slot, so there is no layout jump between send and stop.
  // `Send`/`Cancel` already self-disable via their own hooks (disabled when
  // running/empty for Send, disabled when not running for Cancel — see
  // `@assistant-ui/react`'s `createActionButton`), so `isRunning` here only
  // drives which one is *visible*; it never duplicates that disabled logic.
  const isRunning = useThread((state) => state.isRunning)

  const iconSize = embedded ? 'size-4' : 'size-5'
  // Shared shape/focus for both action buttons; the design-system `Button`'s
  // focus ring is lost when swapping to a plain <button> (see Send note below),
  // so restore an equivalent `focus-visible` ring here.
  const baseAction = twMerge(
    'focus-visible:ring-ring absolute inset-0 flex items-center justify-center rounded-full transition-[opacity,transform,background-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed motion-reduce:transition-none motion-reduce:transform-none'
  )
  const crossfade = (visible: boolean) =>
    visible ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'

  return (
    <div
      className={twMerge(
        'relative shrink-0',
        embedded ? 'm-1 size-7' : 'm-2 size-9'
      )}
    >
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
          aria-hidden={isRunning}
          inert={isRunning}
          tabIndex={isRunning ? -1 : 0}
          aria-label={t('chat.composer.send')}
          className={twMerge(
            baseAction,
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
            'disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
            crossfade(!isRunning)
          )}
        >
          <SendHorizontalIcon className={iconSize} />
        </button>
      </ComposerPrimitive.Send>
      <ComposerPrimitive.Cancel asChild>
        <button
          type="button"
          data-cy="chat-cancel-button"
          aria-hidden={!isRunning}
          inert={!isRunning}
          tabIndex={isRunning ? 0 : -1}
          aria-label={t('chat.composer.stop')}
          className={twMerge(
            baseAction,
            'text-foreground hover:bg-accent disabled:opacity-50',
            crossfade(isRunning)
          )}
        >
          <SquareIcon className={iconSize} />
        </button>
      </ComposerPrimitive.Cancel>
    </div>
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
      className="animate-in fade-in slide-in-from-bottom-2 flex w-full max-w-[var(--thread-max-width)] flex-col items-end gap-y-1 py-2 duration-300 motion-reduce:animate-none sm:py-4"
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
      className="text-muted-foreground flex items-center gap-1"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          {editDisabled ? (
            <button
              type="button"
              aria-disabled="true"
              className={twMerge(
                actionBarButtonClassName,
                'cursor-not-allowed opacity-50'
              )}
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
                className={actionBarButtonClassName}
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
            <button className={actionBarButtonClassName}>
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
      // The edit MUST go through the edit composer's own send: it is the
      // only path that submits the composer's captured `parentId` without
      // loss, so editing a thread's first message (parentId `null`) still
      // reaches the store's `onEdit` and creates a sibling branch. The
      // public `threadRuntime.append()` normalizes a `null` parentId to
      // "last message in the current path" (@assistant-ui/core
      // thread-runtime `toAppendMessage`), which made the external store
      // treat root edits as brand-new turns — the bug that kept the
      // BranchPicker permanently hidden.
      //
      // `startRun: true` because the vendor's own change gate
      // (`text !== previous || attachmentsChanged`) cannot see the *kept*
      // original attachments this app tracks outside the composer
      // (`editRemovedAttachmentKeysByMessageId`), and would silently
      // no-op a kept-attachment-only edit. `canSubmit` above is the real
      // change gate; once it passes, the run should start unconditionally.
      messageRuntime.composer.send({ startRun: true })
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
            {/* Cancel keeps the design-system default (outline) variant. */}
            <Button
              data-cy="chat-edit-cancel-button"
              onClick={() => {
                clearEditRemovedAttachmentKeys(message.id)
                messageRuntime.composer.cancel()
              }}
              className={{ root: 'rounded-full font-semibold' }}
            >
              <Button.Label>{t('chat.composer.editCancel')}</Button.Label>
            </Button>
            {/*
             * Send is the primary action → UZH-blue fill, applied by hand: the
             * design-system `primary` prop paints `bg-primary-100`, a token this
             * app never defines. Overriding through `className.root` means every
             * class the `outline` variant sets must be answered explicitly, since
             * twMerge only drops classes in the same conflict group — hence
             * `hover:text-primary-foreground` (without it the label keeps the
             * variant's `hover:text-accent-foreground`, i.e. black on blue).
             */}
            <Button
              data-cy="chat-edit-send-button"
              onClick={() => void handleSend()}
              disabled={!canSubmit}
              className={{
                root: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:hover:bg-primary rounded-full border-transparent font-semibold',
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

/**
 * Friendly activity chip, styled like the doc-query tool chips in
 * `tool-fallback.tsx`, shown on an assistant reply whose parent user
 * message (one hop up the active branch's `parentId` chain) attached at
 * least one image. There is no async "analyzing" state to track — the
 * image was already sent with the request — so this is a static badge,
 * not a running/done toggle like the tool chips.
 */
const ImageAnalyzedChip: FC = () => {
  const t = useTranslations()
  const message = useMessage() as MessageWithCustomMetadata
  const hasImageAttachment = useChatStore((state) => {
    const activeThread = state.threads.find(
      (thread) => thread.id === state.activeThreadId
    )
    return parentMessageHasImageAttachment(
      activeThread?.messages ?? EMPTY_MESSAGES,
      message.id
    )
  })

  if (!hasImageAttachment) return null

  return (
    <div className="mb-1">
      <span
        data-cy="chat-image-analyzed"
        className="text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
      >
        <ImageIcon className="size-3" aria-hidden />
        {t('chat.tools.imageAnalyzed')}
      </span>
    </div>
  )
}

const AssistantMessage: FC<{
  chatbotAvatar: string
}> = ({ chatbotAvatar }) => {
  const { embedded } = useChatUi()
  // True only for the synthetic empty assistant message the runtime injects
  // while a response is pending (before the first streamed part arrives).
  const isPendingEmpty = useMessage(
    (m) =>
      m.role === 'assistant' &&
      m.status?.type === 'running' &&
      m.content.length === 0
  )
  // Computed once here (not inside SourcesSection/MarkdownText) and shared
  // via context, so the sources grid and the inline `[n]` citation chips
  // read the same normalized list instead of each re-parsing the tool JSON.
  const messageSources = useMessageSources()

  return (
    <MessagePrimitive.Root
      data-cy="chat-assistant-message"
      className={twMerge(
        'animate-in fade-in slide-in-from-bottom-2 relative grid w-full max-w-[var(--thread-max-width)] grid-rows-[auto_1fr] py-2 duration-300 motion-reduce:animate-none sm:py-4',
        embedded ? 'grid-cols-[auto_1fr]' : 'grid-cols-[auto_auto_1fr]'
      )}
    >
      {!embedded && (
        <div className="col-start-1 row-span-2 row-start-1 mr-2 mt-2 flex items-start pr-1 sm:mr-3 sm:mt-3 sm:pr-2">
          <Image
            src={
              chatbotAvatar
                ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${chatbotAvatar}.svg`
                : '/user-solid.svg'
            }
            alt=""
            width={chatbotAvatar ? '35' : '32'}
            height="35"
            unoptimized={Boolean(chatbotAvatar)}
            className={twMerge(
              'hidden rounded-full bg-white sm:block',
              chatbotAvatar ? '' : 'p-1'
            )}
          />
          <Image
            src={
              chatbotAvatar
                ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${chatbotAvatar}.svg`
                : '/user-solid.svg'
            }
            alt=""
            width="24"
            height="24"
            unoptimized={Boolean(chatbotAvatar)}
            className={twMerge(
              'rounded-full bg-white sm:hidden',
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
        {isPendingEmpty && <ThinkingDots />}
        <ImageAnalyzedChip />
        <MessageSourcesProvider value={messageSources}>
          <AssistantMessageParts />
          <SourcesSection />
        </MessageSourcesProvider>
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
        className="text-muted-foreground -ml-1 flex gap-1"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ActionBarPrimitive.Copy asChild>
              <button
                data-cy="chat-copy-message-button"
                className={actionBarButtonClassName}
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
                className={actionBarButtonClassName}
              >
                <RefreshCwIcon />
                <span className="sr-only">{t('chat.message.refresh')}</span>
              </button>
            </ActionBarPrimitive.Reload>
          </TooltipTrigger>
          <TooltipContent>{t('chat.message.refresh')}</TooltipContent>
        </Tooltip>

        <MessageRatingButtons />

        <BranchPickerWrapper />
      </ActionBarPrimitive.Root>
    </div>
  )
}

const MessageRatingButtons: FC = () => {
  const t = useTranslations()
  const message = useMessage()
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const rateMessage = useChatStore((state) => state.rateMessage)
  // The active vote comes from the feedback adapter's own metadata field
  // (populated by `convertMessage` in RuntimeProvider from the store's
  // persisted rating), not a separate zustand selector.
  const submittedFeedbackType = message.metadata.submittedFeedback?.type ?? null

  if (!chatbotId) return null

  const options = [
    {
      value: 'UP' as const,
      feedbackType: 'positive' as const,
      FeedbackPrimitive: ActionBarPrimitive.FeedbackPositive,
      Icon: ThumbsUpIcon,
      label: t('chat.message.rateUp'),
    },
    {
      value: 'DOWN' as const,
      feedbackType: 'negative' as const,
      FeedbackPrimitive: ActionBarPrimitive.FeedbackNegative,
      Icon: ThumbsDownIcon,
      label: t('chat.message.rateDown'),
    },
  ]

  return (
    <>
      {options.map(
        ({ value, feedbackType, FeedbackPrimitive, Icon, label }) => {
          const isActive = submittedFeedbackType === feedbackType
          return (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <FeedbackPrimitive
                  asChild
                  // The feedback adapter only models "submit a vote": clicking
                  // the already-active vote here clears it instead, so a
                  // misclick is undoable. That clear path bypasses the
                  // adapter (there is no "retract" concept in assistant-ui)
                  // and calls the same store action directly.
                  onClick={(event: MouseEvent) => {
                    if (isActive) {
                      event.preventDefault()
                      void rateMessage(chatbotId, message.id, null)
                    }
                  }}
                >
                  <button
                    data-cy={`chat-rate-${value.toLowerCase()}-button`}
                    aria-pressed={isActive}
                    className={twMerge(
                      actionBarButtonClassName,
                      isActive && 'text-primary'
                    )}
                  >
                    {/* The cast icon is filled, not merely recoloured: primary
                      against muted-foreground is only ~2.4:1 (~2.0:1 in dark
                      mode), so colour alone would leave the active vote
                      indistinguishable under WCAG 1.4.1/1.4.11. */}
                    <Icon className={isActive ? 'fill-current' : undefined} />
                    <span className="sr-only">{label}</span>
                  </button>
                </FeedbackPrimitive>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          )
        }
      )}
    </>
  )
}

const BranchPickerWrapper: FC = () => {
  const message = useMessage()
  return <BranchPicker messageId={message.id} />
}
