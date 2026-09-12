import { useQuery } from '@apollo/client'
import {
  faArrowUpRightFromSquare,
  faComments,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseChatbotsDocument,
  type GetCourseChatbotsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import type { KlickerChatContext } from '@klicker-uzh/types'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'

type CourseChatbot = NonNullable<
  GetCourseChatbotsQuery['courseChatbots']
>[number]

type CourseChatDrawerProps = {
  courseId: string
  context: KlickerChatContext
  enabled?: boolean
  embedded?: boolean
}

const CHAT_CONTEXT_MESSAGE_TYPE = 'klicker:chat-context'
const CHAT_CONTEXT_ACK_MESSAGE_TYPE = 'klicker:chat-context-ack'
const PWA_APP_ROOT_ID = '__next'
const COURSE_CHAT_DIALOG_ID = 'course-chatbot-dialog'

export function CourseChatDrawer({
  courseId,
  context,
  enabled = true,
  embedded = false,
}: CourseChatDrawerProps) {
  const t = useTranslations()
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const nextMessageIdRef = useRef(0)
  const ackedMessageIdRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(
    null
  )
  const [frameLoaded, setFrameLoaded] = useState(false)

  const { data, loading } = useQuery(GetCourseChatbotsDocument, {
    variables: { courseId },
    skip: !enabled,
  })

  const chatbots = useMemo(() => data?.courseChatbots ?? [], [data])
  const available = enabled && !loading && chatbots.length > 0
  const selectedChatbot =
    chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? chatbots[0]
  const chatOrigin = useMemo(() => getChatOrigin(), [])

  const contextLabel = useMemo(() => {
    const { currentStep, totalSteps } = context.question ?? {}
    if (currentStep != null && totalSteps != null && totalSteps > 0) {
      return t('pwa.chatbot.questionContext', { currentStep, totalSteps })
    }

    return t('pwa.chatbot.activeContext')
  }, [context.question, t])

  const localePrefix = router.locale ? `/${router.locale}` : ''
  const chatbotPath = selectedChatbot
    ? `${localePrefix}/course/${encodeURIComponent(
        courseId
      )}/chatbot/${encodeURIComponent(selectedChatbot.id)}`
    : null
  const iframeSrc = chatbotPath ? `${chatbotPath}?embed=true` : null
  const newTabHref = chatbotPath

  useEffect(() => {
    if (!selectedChatbotId && chatbots.length > 0) {
      setSelectedChatbotId(chatbots[0].id)
    }
  }, [chatbots, selectedChatbotId])

  const closeWidget = useCallback(() => {
    shouldRestoreFocusRef.current = true
    setOpen(false)
    setFrameLoaded(false)
    ackedMessageIdRef.current = 0
  }, [])

  useEffect(() => {
    if (open || !shouldRestoreFocusRef.current) return
    shouldRestoreFocusRef.current = false
    triggerRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || !available) return
    const panel = panelRef.current
    if (!panel) return

    const target = getFocusableElements(panel)[0] ?? panel
    target.focus()
  }, [available, open])

  useEffect(() => {
    if (!open || !available) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeWidget()
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusables = getFocusableElements(panel)
      if (focusables.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [available, closeWidget, open])

  useEffect(() => {
    if (!open || !available) return

    const appRoot = document.getElementById(PWA_APP_ROOT_ID)
    if (!appRoot) return

    const wasInert = appRoot.inert
    const previousAriaHidden = appRoot.getAttribute('aria-hidden')
    appRoot.inert = true
    appRoot.setAttribute('aria-hidden', 'true')

    return () => {
      appRoot.inert = wasInert
      if (previousAriaHidden === null) {
        appRoot.removeAttribute('aria-hidden')
      } else {
        appRoot.setAttribute('aria-hidden', previousAriaHidden)
      }
    }
  }, [available, open])

  useEffect(() => {
    if (!open || available) return
    closeWidget()
  }, [available, closeWidget, open])

  useEffect(() => {
    if (!open) return

    router.events.on('routeChangeStart', closeWidget)
    return () => router.events.off('routeChangeStart', closeWidget)
  }, [closeWidget, open, router.events])

  useEffect(() => {
    if (!open || !chatOrigin) return

    function handleMessage(event: MessageEvent) {
      if (event.origin !== chatOrigin) return

      const frameWindow = iframeRef.current?.contentWindow
      if (frameWindow && event.source !== frameWindow) return

      if (isContextAckMessage(event.data)) {
        const messageId = event.data.payload.messageId
        if (typeof messageId === 'number') {
          ackedMessageIdRef.current = Math.max(
            ackedMessageIdRef.current,
            messageId
          )
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [chatOrigin, open])

  useEffect(() => {
    if (!open || !frameLoaded || !chatOrigin || !iframeRef.current) return

    const messageId = nextMessageIdRef.current + 1
    nextMessageIdRef.current = messageId
    postContext(iframeRef.current, context, chatOrigin, messageId)

    const timeouts = [300, 1000, 2500].map((delay) =>
      window.setTimeout(() => {
        if (ackedMessageIdRef.current >= messageId) return
        postContext(iframeRef.current, context, chatOrigin, messageId)
      }, delay)
    )

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout))
    }
  }, [chatOrigin, context, frameLoaded, open])

  if (!available) {
    return null
  }

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          aria-controls={COURSE_CHAT_DIALOG_ID}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('pwa.chatbot.openCourseChat')}
          onClick={() => {
            setFrameLoaded(false)
            ackedMessageIdRef.current = 0
            setOpen(true)
          }}
          className={twMerge(
            'bg-uzh-blue hover:bg-uzh-blue-80 focus-visible:outline-uzh-blue-40 fixed z-30 inline-flex items-center justify-center gap-3 rounded-full text-white shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            embedded
              ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 h-12 min-w-12 px-1.5'
              : 'bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 h-14 min-w-14 px-3 md:bottom-6 md:px-4'
          )}
          data-cy="course-chatbot-open"
        >
          <ChatbotAvatar
            chatbot={selectedChatbot}
            className={twMerge(
              'text-uzh-blue border border-white/40 bg-white',
              embedded ? 'size-9' : 'size-10'
            )}
          />
          {!embedded && (
            <span className="hidden pr-1 text-sm font-semibold sm:inline">
              {t('pwa.chatbot.openCourseChat')}
            </span>
          )}
        </button>
      )}

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={COURSE_CHAT_DIALOG_ID}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('pwa.chatbot.courseChat')}
            tabIndex={-1}
            className={twMerge(
              'fixed z-[60] flex flex-col overflow-hidden border-gray-200 bg-white shadow-2xl focus:outline-none',
              embedded
                ? 'inset-x-0 bottom-0 h-[min(82dvh,34rem)] max-h-[100dvh] rounded-t-md border-t sm:inset-x-2 sm:bottom-2 sm:max-h-[calc(100dvh-1rem)] sm:rounded-md sm:border'
                : 'inset-x-0 bottom-0 h-[min(85dvh,44rem)] min-h-[28rem] border-t md:inset-x-auto md:bottom-6 md:right-4 md:h-[min(42rem,calc(100dvh-3rem))] md:w-[27rem] md:rounded-md md:border'
            )}
            data-cy="course-chatbot-drawer"
          >
            <div
              className={twMerge(
                'flex shrink-0 items-start gap-3 border-b bg-white',
                embedded ? 'px-2.5 py-2.5' : 'px-3 py-3'
              )}
            >
              <ChatbotAvatar
                chatbot={selectedChatbot}
                className={twMerge(
                  'text-uzh-blue mt-0.5 border border-gray-200 bg-gray-50',
                  embedded ? 'size-10' : 'size-11'
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {selectedChatbot?.name ?? t('pwa.chatbot.courseChat')}
                </div>
                <div className="mt-1 inline-flex max-w-full items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                  <span className="truncate">{contextLabel}</span>
                </div>
                {chatbots.length > 1 && (
                  <select
                    value={selectedChatbot?.id ?? ''}
                    onChange={(event) => {
                      setSelectedChatbotId(event.target.value)
                      setFrameLoaded(false)
                      ackedMessageIdRef.current = 0
                    }}
                    className="focus:border-uzh-blue focus:ring-uzh-blue mt-2 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1"
                    aria-label={t('pwa.chatbot.selectChatbot')}
                    data-cy="course-chatbot-selector"
                  >
                    {chatbots.map((chatbot) => (
                      <option key={chatbot.id} value={chatbot.id}>
                        {chatbot.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {newTabHref && (
                <a
                  href={newTabHref}
                  target="_blank"
                  rel="noreferrer"
                  className={twMerge(
                    'text-uzh-blue hover:text-uzh-blue-80 inline-flex shrink-0 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                    embedded ? 'size-10' : 'size-11'
                  )}
                  aria-label={t('pwa.chatbot.openInNewTab')}
                  data-cy="course-chatbot-new-tab"
                >
                  <FontAwesomeIcon
                    icon={faArrowUpRightFromSquare}
                    aria-hidden
                  />
                </a>
              )}
              <button
                type="button"
                onClick={closeWidget}
                className={twMerge(
                  'inline-flex shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                  embedded ? 'size-10' : 'size-11'
                )}
                aria-label={t('shared.generic.close')}
                data-cy="course-chatbot-close"
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 bg-white">
              {iframeSrc && (
                <iframe
                  key={selectedChatbot?.id}
                  ref={iframeRef}
                  src={iframeSrc}
                  title={t('pwa.chatbot.courseChat')}
                  className={twMerge(
                    'h-full w-full border-0',
                    embedded ? 'min-h-0' : 'min-h-[24rem]'
                  )}
                  data-cy="course-chatbot-frame"
                  onLoad={() => {
                    setFrameLoaded(true)
                  }}
                />
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

function ChatbotAvatar({
  chatbot,
  className,
}: {
  chatbot?: CourseChatbot
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const avatarSrc = getChatbotAvatarSrc(chatbot?.avatar)

  useEffect(() => {
    setFailed(false)
  }, [avatarSrc])

  return (
    <span
      className={twMerge(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        className
      )}
      aria-hidden
    >
      {avatarSrc && !failed ? (
        <Image
          src={avatarSrc}
          alt=""
          width={48}
          height={48}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <FontAwesomeIcon icon={faComments} className="size-5" />
      )}
    </span>
  )
}

function postContext(
  iframe: HTMLIFrameElement | null,
  context: KlickerChatContext,
  chatOrigin: string,
  messageId: number
) {
  if (!iframe?.contentWindow) return

  iframe.contentWindow.postMessage(
    {
      type: CHAT_CONTEXT_MESSAGE_TYPE,
      payload: context,
      messageId,
    },
    chatOrigin
  )
}

function isContextAckMessage(data: unknown): data is {
  type: typeof CHAT_CONTEXT_ACK_MESSAGE_TYPE
  payload: { messageId?: unknown }
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === CHAT_CONTEXT_ACK_MESSAGE_TYPE &&
    typeof (data as { payload?: unknown }).payload === 'object' &&
    (data as { payload?: unknown }).payload !== null
  )
}

function getChatbotAvatarSrc(avatar?: string | null): string | null {
  const basePath = process.env.NEXT_PUBLIC_AVATAR_BASE_PATH
  if (!avatar || !basePath) return null
  return `${basePath}/${avatar}.svg`
}

function getChatOrigin(): string | null {
  try {
    return process.env.NEXT_PUBLIC_CHAT_URL
      ? new URL(process.env.NEXT_PUBLIC_CHAT_URL).origin
      : null
  } catch {
    return null
  }
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}
