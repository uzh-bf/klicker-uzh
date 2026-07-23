import {
  faArrowUpRightFromSquare,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import {
  buildManageAssistantUrl,
  isManageAssistantEnabled,
} from './manageAssistantConfig'
import {
  buildManageAssistantContext,
  type ManageAssistantContext,
} from './manageAssistantContext'

const MANAGE_CONTEXT_MESSAGE_TYPE = 'klicker:manage-context'
const MANAGE_CONTEXT_ACK_MESSAGE_TYPE = 'klicker:manage-context-ack'
const MANAGE_CONTEXT_READY_MESSAGE_TYPE = 'klicker:manage-context-ready'

export function ManageAssistantWidget() {
  const t = useTranslations()
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const nextMessageIdRef = useRef(0)
  const ackedMessageIdRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [frameLoaded, setFrameLoaded] = useState(false)

  // Mounted app-wide rather than inside Layout, so the login screen has to be
  // excluded explicitly: every other Manage route requires a signed-in user.
  const enabled =
    isManageAssistantEnabled(
      process.env.NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED
    ) && router.pathname !== '/login'
  const assistantUrl = useMemo(
    () =>
      buildManageAssistantUrl({
        chatUrl: process.env.NEXT_PUBLIC_CHAT_URL,
        locale: router.locale,
      }),
    [router.locale]
  )
  const assistantOrigin = useMemo(
    () => getUrlOrigin(assistantUrl),
    [assistantUrl]
  )
  const assistantContext = useMemo(
    () =>
      buildManageAssistantContext({
        asPath: router.asPath,
        locale: router.locale,
        pathname: router.pathname,
        query: router.query,
      }),
    [router.asPath, router.locale, router.pathname, router.query]
  )
  const assistantContextRef = useRef(assistantContext)
  useEffect(() => {
    assistantContextRef.current = assistantContext
  }, [assistantContext])

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
    if (!open || !assistantOrigin) return

    function handleMessage(event: MessageEvent) {
      if (event.origin !== assistantOrigin) return

      const frameWindow = iframeRef.current?.contentWindow
      if (frameWindow && event.source !== frameWindow) return

      if (isManageContextAckMessage(event.data)) {
        const messageId = event.data.payload.messageId
        if (typeof messageId === 'number') {
          ackedMessageIdRef.current = Math.max(
            ackedMessageIdRef.current,
            messageId
          )
        }
        return
      }

      // The iframe announces readiness once its listener exists. Re-send the
      // current context then: the timed retry burst below can fully elapse
      // before a slow-hydrating iframe is able to receive anything.
      if (isManageContextReadyMessage(event.data)) {
        const messageId = nextMessageIdRef.current + 1
        nextMessageIdRef.current = messageId
        postManageContext(
          iframeRef.current,
          assistantContextRef.current,
          assistantOrigin,
          messageId
        )
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [assistantOrigin, open])

  useEffect(() => {
    if (!open || !frameLoaded || !assistantOrigin || !iframeRef.current) return

    const messageId = nextMessageIdRef.current + 1
    nextMessageIdRef.current = messageId
    postManageContext(
      iframeRef.current,
      assistantContext,
      assistantOrigin,
      messageId
    )

    const timeouts = [300, 1000, 2500].map((delay) =>
      window.setTimeout(() => {
        if (ackedMessageIdRef.current >= messageId) return
        postManageContext(
          iframeRef.current,
          assistantContext,
          assistantOrigin,
          messageId
        )
      }, delay)
    )

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout))
    }
  }, [assistantContext, assistantOrigin, frameLoaded, open])

  if (!enabled || !assistantUrl) {
    return null
  }

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          aria-label={t('manage.assistant.open')}
          onClick={() => {
            setFrameLoaded(false)
            ackedMessageIdRef.current = 0
            setOpen(true)
          }}
          className="bg-uzh-blue hover:bg-uzh-blue-80 focus-visible:outline-uzh-blue-40 fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-14 min-w-14 items-center justify-center gap-3 rounded-full px-3 text-white shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:bottom-6 md:right-6 md:px-4"
          data-cy="manage-assistant-open"
        >
          <AssistantAvatar className="text-uzh-blue size-10 border border-white/40 bg-white" />
          <span className="hidden pr-1 text-sm font-semibold sm:inline">
            {t('manage.assistant.open')}
          </span>
        </button>
      )}

      {open && (
        <aside
          role="dialog"
          aria-label={t('manage.assistant.title')}
          className="fixed bottom-0 left-0 right-0 z-40 flex h-[min(85dvh,44rem)] min-h-[28rem] w-screen flex-col overflow-hidden border-t border-gray-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:left-auto md:right-6 md:h-[min(42rem,calc(100dvh-3rem))] md:w-[28rem] md:rounded-md md:border"
          data-cy="manage-assistant-drawer"
        >
          <div className="flex shrink-0 items-start gap-3 border-b bg-white px-3 py-3">
            <AssistantAvatar className="text-uzh-blue mt-0.5 size-11 border border-gray-200 bg-gray-50" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {t('manage.assistant.title')}
              </div>
              <div className="mt-1 inline-flex max-w-full items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                <span className="truncate">
                  {t('manage.assistant.subtitle')}
                </span>
              </div>
            </div>
            <a
              href={assistantUrl}
              target="_blank"
              rel="noreferrer"
              className="text-uzh-blue hover:text-uzh-blue-80 inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={t('manage.assistant.openInNewTab')}
            >
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden />
            </a>
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
            <iframe
              ref={iframeRef}
              src={assistantUrl}
              title={t('manage.assistant.title')}
              className="h-full min-h-[24rem] w-full border-0"
              data-cy="manage-assistant-frame"
              onLoad={() => setFrameLoaded(true)}
            />
          </div>
        </aside>
      )}
    </>
  )
}

function postManageContext(
  iframe: HTMLIFrameElement | null,
  context: ManageAssistantContext,
  assistantOrigin: string,
  messageId: number
) {
  if (!iframe?.contentWindow) return

  iframe.contentWindow.postMessage(
    {
      type: MANAGE_CONTEXT_MESSAGE_TYPE,
      payload: context,
      messageId,
    },
    assistantOrigin
  )
}

function isManageContextAckMessage(data: unknown): data is {
  type: typeof MANAGE_CONTEXT_ACK_MESSAGE_TYPE
  payload: { messageId?: unknown }
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === MANAGE_CONTEXT_ACK_MESSAGE_TYPE &&
    typeof (data as { payload?: unknown }).payload === 'object' &&
    (data as { payload?: unknown }).payload !== null
  )
}

function isManageContextReadyMessage(data: unknown): data is {
  type: typeof MANAGE_CONTEXT_READY_MESSAGE_TYPE
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === MANAGE_CONTEXT_READY_MESSAGE_TYPE
  )
}

function getUrlOrigin(url: string | null) {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

function AssistantAvatar({ className }: { className?: string }) {
  return (
    <span
      className={twMerge(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        className
      )}
      aria-hidden
    >
      <span className="flex size-full items-center justify-center bg-gradient-to-br from-white via-blue-50 to-cyan-50">
        <FontAwesomeIcon icon={faWandMagicSparkles} className="size-5" />
      </span>
    </span>
  )
}
