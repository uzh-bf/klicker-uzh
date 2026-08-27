import { useApolloClient } from '@apollo/client'
import {
  faArrowUpRightFromSquare,
  faSpinner,
  faUpRightAndDownLeftFromCenter,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetUserElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  MANAGE_CONTEXT_MESSAGE_TYPE,
  MANAGE_CONTEXT_READY_MESSAGE_TYPE,
} from '@klicker-uzh/types'
import { toast } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'

import { useAiFeaturesEnabled } from '../../lib/hooks/useAiFeaturesEnabled'
import { buildManageAssistantUrl } from './manageAssistantConfig'
import {
  buildManageAssistantContext,
  type ManageAssistantContext,
} from './manageAssistantContext'
import {
  clampManageAssistantPanelSize,
  DEFAULT_MANAGE_ASSISTANT_PANEL_SIZE,
  getManageAssistantKeyboardResizeDelta,
  type ManageAssistantPanelSize,
  parseManageAssistantPanelSize,
  resizeManageAssistantPanelFromTopLeft,
} from './manageAssistantPanelSize'
import {
  isManageElementCreatedMessage,
  sanitizeManageElementCreatedPayload,
} from './manageElementCreatedMessage'

const MANAGE_ASSISTANT_PANEL_ID = 'manage-assistant-panel'
const MANAGE_ASSISTANT_PANEL_SIZE_STORAGE_KEY =
  'klicker-manage-assistant-panel-size-v1'

export function ManageAssistantWidget() {
  const t = useTranslations()
  const router = useRouter()
  const apolloClient = useApolloClient()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const resizeSessionRef = useRef<{
    pointerId: number
    startSize: ManageAssistantPanelSize
    startX: number
    startY: number
  } | null>(null)
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [frameLoadedUrl, setFrameLoadedUrl] = useState<string | null>(null)
  const [frameReadyUrl, setFrameReadyUrl] = useState<string | null>(null)
  const [panelSize, setPanelSize] = useState(
    DEFAULT_MANAGE_ASSISTANT_PANEL_SIZE
  )
  const [panelSizeInitialized, setPanelSizeInitialized] = useState(false)

  // Mounted app-wide rather than inside Layout, so the login screen has to be
  // excluded explicitly: every other Manage route requires a signed-in user.
  const assistantEnabled = useAiFeaturesEnabled()
  const enabled = assistantEnabled && router.pathname !== '/login'
  const assistantUrl = useMemo(
    () =>
      buildManageAssistantUrl({
        chatUrl: process.env.NEXT_PUBLIC_CHAT_URL,
        locale: router.locale,
        parentOrigin:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      }),
    [router.locale]
  )
  const frameLoaded = frameLoadedUrl === assistantUrl
  const frameReady = frameReadyUrl === assistantUrl
  // A clean, non-embedded URL for the "open in new tab" link: the embedded
  // URL hides the assistant's login CTA and other affordances that only make
  // sense when Manage itself provides the surrounding chrome.
  const assistantNewTabUrl = useMemo(
    () =>
      buildManageAssistantUrl({
        chatUrl: process.env.NEXT_PUBLIC_CHAT_URL,
        locale: router.locale,
        embed: false,
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

  // Post the current context to the iframe. The call site already sits
  // behind an assistantOrigin guard; the check here is for type safety only.
  const sendCurrentContext = useCallback(() => {
    if (!assistantOrigin) return
    postManageContext(
      iframeRef.current,
      assistantContextRef.current,
      assistantOrigin
    )
  }, [assistantOrigin])

  const closeWidget = useCallback(() => {
    shouldRestoreFocusRef.current = true
    setOpen(false)
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
    const storedSize = readStoredPanelSize()
    if (storedSize) {
      setPanelSize(
        clampManageAssistantPanelSize(storedSize, {
          height: window.innerHeight,
          width: window.innerWidth,
        })
      )
    }
    setPanelSizeInitialized(true)
  }, [])

  useEffect(() => {
    if (!panelSizeInitialized) return
    window.localStorage.setItem(
      MANAGE_ASSISTANT_PANEL_SIZE_STORAGE_KEY,
      JSON.stringify(panelSize)
    )
  }, [panelSize, panelSizeInitialized])

  useEffect(() => {
    function handleResize() {
      setPanelSize((currentSize) =>
        clampManageAssistantPanelSize(currentSize, {
          height: window.innerHeight,
          width: window.innerWidth,
        })
      )
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      resizeSessionRef.current = {
        pointerId: event.pointerId,
        startSize: panelSize,
        startX: event.clientX,
        startY: event.clientY,
      }
    },
    [panelSize]
  )

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = resizeSessionRef.current
      if (!session || session.pointerId !== event.pointerId) return

      setPanelSize(
        resizeManageAssistantPanelFromTopLeft({
          deltaX: event.clientX - session.startX,
          deltaY: event.clientY - session.startY,
          size: session.startSize,
          viewport: { height: window.innerHeight, width: window.innerWidth },
        })
      )
    },
    []
  )

  const handleResizePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (resizeSessionRef.current?.pointerId !== event.pointerId) return
      resizeSessionRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    []
  )

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const delta = getManageAssistantKeyboardResizeDelta(event.key)
      if (!delta) return
      event.preventDefault()
      setPanelSize((currentSize) =>
        resizeManageAssistantPanelFromTopLeft({
          ...delta,
          size: currentSize,
          viewport: { height: window.innerHeight, width: window.innerWidth },
        })
      )
    },
    []
  )

  useEffect(() => {
    if (!assistantOrigin) return

    function handleMessage(event: MessageEvent) {
      if (event.origin !== assistantOrigin) return

      const frameWindow = iframeRef.current?.contentWindow
      if (!frameWindow || event.source !== frameWindow) return

      // The iframe announces readiness once its listener exists. Re-send the
      // current context then: this handshake alone is enough to deliver the
      // context to a slow-hydrating iframe, without a timed retry burst.
      if (isManageContextReadyMessage(event.data)) {
        setFrameReadyUrl(assistantUrl)
        sendCurrentContext()
        return
      }

      // A confirmed proposal created a new question-pool element. The
      // payload crossed a postMessage boundary from the iframe, so treat it
      // as untrusted data rather than an instruction: validate its shape
      // before using it for anything, and never render it as HTML.
      if (isManageElementCreatedMessage(event.data)) {
        const element = sanitizeManageElementCreatedPayload(event.data.payload)
        if (!element) return

        apolloClient.refetchQueries({ include: [GetUserElementsDocument] })
        toast({
          type: 'success',
          message: t('manage.assistant.elementCreatedToast', {
            name: element.name,
          }),
        })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [apolloClient, assistantOrigin, assistantUrl, sendCurrentContext, t])

  // Sends the current context once the iframe has loaded, and again whenever
  // the context itself changes (e.g. a route change while the widget stays
  // open). The `klicker:manage-context-ready` handshake above covers the
  // case where the iframe is still hydrating when this first send happens.
  useEffect(() => {
    if (!hasOpened || !frameLoaded || !assistantOrigin || !iframeRef.current) {
      return
    }
    postManageContext(iframeRef.current, assistantContext, assistantOrigin)
  }, [assistantContext, assistantOrigin, frameLoaded, hasOpened])

  if (!enabled || !assistantUrl) {
    return null
  }

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          aria-controls={MANAGE_ASSISTANT_PANEL_ID}
          aria-expanded={open}
          aria-label={t('manage.assistant.open')}
          onClick={() => {
            setHasOpened(true)
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

      {(open || hasOpened) &&
        typeof document !== 'undefined' &&
        createPortal(
          <aside
            id={MANAGE_ASSISTANT_PANEL_ID}
            aria-hidden={!open}
            aria-label={t('manage.assistant.title')}
            inert={!open}
            style={
              {
                '--manage-assistant-height': `${panelSize.height}px`,
                '--manage-assistant-width': `${panelSize.width}px`,
              } as CSSProperties
            }
            className={twMerge(
              'fixed bottom-0 left-0 right-0 z-40 flex h-[min(85dvh,44rem)] min-h-[28rem] w-screen flex-col overflow-hidden overscroll-contain border-t border-gray-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:left-auto md:right-6 md:h-[var(--manage-assistant-height)] md:w-[var(--manage-assistant-width)] md:rounded-md md:border',
              !open && 'hidden'
            )}
            data-cy="manage-assistant-drawer"
          >
            <div className="relative flex shrink-0 items-start gap-3 border-b bg-white px-3 py-3 md:pl-9">
              <button
                type="button"
                className="focus-visible:outline-uzh-blue-40 absolute left-1 top-1 hidden size-7 touch-none cursor-nwse-resize items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 md:inline-flex"
                aria-label={t('manage.assistant.resize')}
                aria-describedby="manage-assistant-resize-hint"
                data-cy="manage-assistant-resize"
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerEnd}
                onPointerCancel={handleResizePointerEnd}
                onKeyDown={handleResizeKeyDown}
              >
                <FontAwesomeIcon
                  icon={faUpRightAndDownLeftFromCenter}
                  aria-hidden
                  className="size-3"
                />
              </button>
              <span id="manage-assistant-resize-hint" className="sr-only">
                {t('manage.assistant.resizeHint')}
              </span>
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
                href={assistantNewTabUrl ?? assistantUrl}
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

            <div className="relative min-h-0 flex-1 bg-white">
              {!frameReady ? (
                <div
                  role="status"
                  className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-white text-sm text-gray-600"
                  data-cy="manage-assistant-loading"
                >
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    aria-hidden
                    className="text-uzh-blue size-5"
                  />
                  <span>{t('manage.assistant.loading')}</span>
                </div>
              ) : null}
              <iframe
                ref={iframeRef}
                src={assistantUrl}
                title={t('manage.assistant.title')}
                aria-hidden={!frameReady}
                tabIndex={frameReady ? undefined : -1}
                className={twMerge(
                  'h-full min-h-[24rem] w-full border-0 transition-opacity',
                  frameReady ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
                data-cy="manage-assistant-frame"
                onLoad={() => setFrameLoadedUrl(assistantUrl)}
              />
            </div>
          </aside>,
          document.body
        )}
    </>
  )
}

function postManageContext(
  iframe: HTMLIFrameElement | null,
  context: ManageAssistantContext,
  assistantOrigin: string
) {
  if (!iframe?.contentWindow) return

  iframe.contentWindow.postMessage(
    {
      type: MANAGE_CONTEXT_MESSAGE_TYPE,
      payload: context,
    },
    assistantOrigin
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

function readStoredPanelSize(): ManageAssistantPanelSize | null {
  return parseManageAssistantPanelSize(
    window.localStorage.getItem(MANAGE_ASSISTANT_PANEL_SIZE_STORAGE_KEY)
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
