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
import { twMerge } from 'tailwind-merge'

type CourseChatbot = NonNullable<
  GetCourseChatbotsQuery['courseChatbots']
>[number]

type CourseChatDrawerProps = {
  courseId: string
  context: KlickerChatContext
  enabled?: boolean
}

const CHAT_CONTEXT_MESSAGE_TYPE = 'klicker:chat-context'
const CHAT_CONTEXT_ACK_MESSAGE_TYPE = 'klicker:chat-context-ack'

export function CourseChatDrawer({
  courseId,
  context,
  enabled = true,
}: CourseChatDrawerProps) {
  const t = useTranslations()
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
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
  const selectedChatbot =
    chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? chatbots[0]
  const chatOrigin = useMemo(getChatOrigin, [])

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
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeWidget()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeWidget, open])

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

  if (!enabled || loading || chatbots.length === 0) {
    return null
  }

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          aria-label={t('pwa.chatbot.openCourseChat')}
          onClick={() => {
            setFrameLoaded(false)
            ackedMessageIdRef.current = 0
            setOpen(true)
          }}
          className="bg-uzh-blue hover:bg-uzh-blue-80 focus-visible:outline-uzh-blue-40 fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-14 min-w-14 items-center justify-center gap-3 rounded-full px-3 text-white shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:bottom-6 md:px-4"
          data-cy="course-chatbot-open"
        >
          <ChatbotAvatar
            chatbot={selectedChatbot}
            className="text-uzh-blue size-10 border border-white/40 bg-white"
          />
          <span className="hidden pr-1 text-sm font-semibold sm:inline">
            {t('pwa.chatbot.openCourseChat')}
          </span>
        </button>
      )}

      {open && (
        <aside
          role="dialog"
          aria-label={t('pwa.chatbot.courseChat')}
          className="fixed inset-x-0 bottom-0 z-40 flex h-[min(85dvh,44rem)] min-h-[28rem] flex-col overflow-hidden border-t border-gray-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:right-4 md:h-[min(42rem,calc(100dvh-3rem))] md:w-[27rem] md:rounded-md md:border"
          data-cy="course-chatbot-drawer"
        >
          <div className="flex shrink-0 items-start gap-3 border-b bg-white px-3 py-3">
            <ChatbotAvatar
              chatbot={selectedChatbot}
              className="text-uzh-blue mt-0.5 size-11 border border-gray-200 bg-gray-50"
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
                className="text-uzh-blue hover:text-uzh-blue-80 inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label={t('pwa.chatbot.openInNewTab')}
              >
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden />
              </a>
            )}
            <button
              type="button"
              onClick={closeWidget}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={t('shared.generic.close')}
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
                className={twMerge('h-full min-h-[24rem] w-full border-0')}
                onLoad={() => {
                  setFrameLoaded(true)
                }}
              />
            )}
          </div>
        </aside>
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
