import { useApolloClient } from '@apollo/client'
import {
  faArrowUpRightFromSquare,
  faRotateRight,
  faSpinner,
  faUpRightAndDownLeftFromCenter,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetUserElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  MANAGE_CLOSE_REQUEST_MESSAGE_TYPE,
  MANAGE_CONTEXT_MESSAGE_TYPE,
  MANAGE_CONTEXT_READY_MESSAGE_TYPE,
} from '@klicker-uzh/types'
import { Tooltip, toast } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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
  createManageAssistantFrameState,
  MANAGE_ASSISTANT_LOADING_DEADLINE_MS,
  reduceManageAssistantFrameState,
} from './manageAssistantFrameState'
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
const DESKTOP_PANEL_MEDIA_QUERY = '(min-width: 768px)'

export function ManageAssistantWidget() {
  const t = useTranslations()
  const router = useRouter()
  const apolloClient = useApolloClient()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const resizeSessionRef = useRef<{
    pointerId: number
    startSize: ManageAssistantPanelSize
    startX: number
    startY: number
  } | null>(null)
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
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
  const [frameState, dispatchFrameState] = useReducer(
    reduceManageAssistantFrameState,
    assistantUrl,
    createManageAssistantFrameState
  )
  const frameReady =
    frameState.phase === 'ready' && frameState.url === assistantUrl
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

  useEffect(() => {
    dispatchFrameState({ type: 'url-changed', url: assistantUrl })
  }, [assistantUrl])

  useEffect(() => {
    if (
      !open ||
      !assistantUrl ||
      frameState.url !== assistantUrl ||
      (frameState.phase !== 'loading' && frameState.phase !== 'retrying')
    ) {
      return
    }

    const generation = frameState.generation
    const deadline = window.setTimeout(() => {
      dispatchFrameState({
        generation,
        type: 'deadline',
        url: assistantUrl,
      })
    }, MANAGE_ASSISTANT_LOADING_DEADLINE_MS)

    return () => window.clearTimeout(deadline)
  }, [
    assistantUrl,
    frameState.generation,
    frameState.phase,
    frameState.url,
    open,
  ])

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
    closeButtonRef.current?.focus()
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
    const initialSize =
      readStoredPanelSize() ?? DEFAULT_MANAGE_ASSISTANT_PANEL_SIZE
    setPanelSize(
      window.matchMedia(DESKTOP_PANEL_MEDIA_QUERY).matches
        ? clampManageAssistantPanelSize(initialSize, {
            height: window.innerHeight,
            width: window.innerWidth,
          })
        : initialSize
    )
    setPanelSizeInitialized(true)
  }, [])

  useEffect(() => {
    if (
      !panelSizeInitialized ||
      !window.matchMedia(DESKTOP_PANEL_MEDIA_QUERY).matches
    ) {
      return
    }
    writeStoredPanelSize(panelSize)
  }, [panelSize, panelSizeInitialized])

  useEffect(() => {
    function handleResize() {
      if (!window.matchMedia(DESKTOP_PANEL_MEDIA_QUERY).matches) return
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
    if (!assistantOrigin || !assistantUrl) return
    const readyUrl = assistantUrl
    const readyGeneration = frameState.generation

    function handleMessage(event: MessageEvent) {
      if (event.origin !== assistantOrigin) return

      const frameWindow = iframeRef.current?.contentWindow
      if (!frameWindow || event.source !== frameWindow) return

      if (isManageCloseRequestMessage(event.data)) {
        closeWidget()
        return
      }

      // The iframe announces readiness once its listener exists. Re-send the
      // current context then: this handshake alone is enough to deliver the
      // context to a slow-hydrating iframe, without a timed retry burst.
      if (isManageContextReadyMessage(event.data)) {
        dispatchFrameState({
          generation: readyGeneration,
          type: 'ready',
          url: readyUrl,
        })
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
  }, [
    apolloClient,
    assistantOrigin,
    assistantUrl,
    closeWidget,
    frameState.generation,
    sendCurrentContext,
    t,
  ])

  // Send later route changes after the validated readiness handshake. The
  // handshake itself sends the initial context, including after a locale
  // change loads a new iframe URL.
  useEffect(() => {
    if (!frameReady || !assistantOrigin || !iframeRef.current) {
      return
    }
    postManageContext(iframeRef.current, assistantContext, assistantOrigin)
  }, [assistantContext, assistantOrigin, frameReady])

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
          className="bg-uzh-blue hover:bg-uzh-blue-80 focus-visible:outline-uzh-blue-40 fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex size-12 items-center justify-center rounded-full p-1 text-white shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:bottom-6 md:right-6"
          data-cy="manage-assistant-open"
        >
          <AssistantAvatar className="text-uzh-blue size-10 border border-white/40 bg-white" />
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
              'fixed bottom-0 left-0 right-0 z-40 flex h-[min(85dvh,44rem)] w-screen flex-col overflow-hidden overscroll-contain border-t border-gray-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:left-auto md:right-6 md:h-[var(--manage-assistant-height)] md:w-[var(--manage-assistant-width)] md:rounded-md md:border',
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
              <Tooltip
                tooltip={t('manage.assistant.openInNewTab')}
                delay={0}
                className={{ tooltip: 'z-50 max-w-xs' }}
              >
                <a
                  href={assistantNewTabUrl ?? assistantUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-uzh-blue hover:text-uzh-blue-80 inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label={t('manage.assistant.openInNewTab')}
                  title={t('manage.assistant.openInNewTab')}
                  data-cy="manage-assistant-new-tab"
                >
                  <FontAwesomeIcon
                    icon={faArrowUpRightFromSquare}
                    aria-hidden
                  />
                </a>
              </Tooltip>
              <button
                ref={closeButtonRef}
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
                  role={frameState.phase === 'failed' ? 'alert' : 'status'}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-white px-6 text-sm text-gray-600"
                  data-cy={
                    frameState.phase === 'failed'
                      ? 'manage-assistant-failed'
                      : frameState.phase === 'delayed'
                        ? 'manage-assistant-delayed'
                        : 'manage-assistant-loading'
                  }
                >
                  {frameState.phase === 'loading' ||
                  frameState.phase === 'retrying' ? (
                    <div className="flex items-center gap-3">
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                        aria-hidden
                        className="text-uzh-blue size-5"
                      />
                      <span>
                        {t(
                          frameState.phase === 'retrying'
                            ? 'manage.assistant.retrying'
                            : 'manage.assistant.loading'
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="max-w-md text-center">
                      <div className="font-semibold text-gray-900">
                        {t(
                          frameState.phase === 'failed'
                            ? 'manage.assistant.failedTitle'
                            : 'manage.assistant.delayedTitle'
                        )}
                      </div>
                      <p className="mt-2">
                        {t(
                          frameState.phase === 'failed'
                            ? 'manage.assistant.failedDescription'
                            : 'manage.assistant.delayedDescription'
                        )}
                      </p>
                      <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            dispatchFrameState({
                              type: 'retry',
                              url: assistantUrl,
                            })
                          }}
                          className="bg-uzh-blue hover:bg-uzh-blue-80 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          data-cy="manage-assistant-retry"
                        >
                          <FontAwesomeIcon icon={faRotateRight} aria-hidden />
                          {t('manage.assistant.retry')}
                        </button>
                        <a
                          href={assistantNewTabUrl ?? assistantUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-uzh-blue inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          data-cy="manage-assistant-fallback"
                        >
                          <FontAwesomeIcon
                            icon={faArrowUpRightFromSquare}
                            aria-hidden
                          />
                          {t('manage.assistant.openFreshConversation')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              <iframe
                key={`${assistantUrl}:${frameState.generation}`}
                ref={iframeRef}
                src={assistantUrl}
                title={t('manage.assistant.title')}
                aria-hidden={!frameReady}
                tabIndex={frameReady ? undefined : -1}
                className={twMerge(
                  'h-full min-h-0 w-full border-0 transition-opacity',
                  frameReady ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
                data-cy="manage-assistant-frame"
                onError={() => {
                  dispatchFrameState({
                    generation: frameState.generation,
                    type: 'error',
                    url: assistantUrl,
                  })
                }}
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

function isManageCloseRequestMessage(data: unknown): data is {
  type: typeof MANAGE_CLOSE_REQUEST_MESSAGE_TYPE
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === MANAGE_CLOSE_REQUEST_MESSAGE_TYPE
  )
}

function readStoredPanelSize(): ManageAssistantPanelSize | null {
  try {
    return parseManageAssistantPanelSize(
      window.localStorage.getItem(MANAGE_ASSISTANT_PANEL_SIZE_STORAGE_KEY)
    )
  } catch {
    return null
  }
}

function writeStoredPanelSize(size: ManageAssistantPanelSize) {
  try {
    window.localStorage.setItem(
      MANAGE_ASSISTANT_PANEL_SIZE_STORAGE_KEY,
      JSON.stringify(size)
    )
  } catch {
    // The dock remains usable when browser privacy settings block storage.
  }
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
