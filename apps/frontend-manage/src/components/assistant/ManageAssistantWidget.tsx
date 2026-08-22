import { useApolloClient } from '@apollo/client'
import {
  faArrowUpRightFromSquare,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import { GetUserElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  MANAGE_CONTEXT_MESSAGE_TYPE,
  MANAGE_CONTEXT_READY_MESSAGE_TYPE,
} from '@klicker-uzh/types'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'

import { buildManageAssistantUrl } from './manageAssistantConfig'
import {
  buildManageAssistantContext,
  type ManageAssistantContext,
} from './manageAssistantContext'
import {
  isManageElementCreatedMessage,
  sanitizeManageElementCreatedPayload,
} from './manageElementCreatedMessage'

const MANAGE_APP_ROOT_ID = '__app'
const MANAGE_ASSISTANT_DIALOG_ID = 'manage-assistant-dialog'

export function ManageAssistantWidget() {
  const t = useTranslations()
  const router = useRouter()
  const apolloClient = useApolloClient()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [frameLoaded, setFrameLoaded] = useState(false)

  // Mounted app-wide rather than inside Layout, so the login screen has to be
  // excluded explicitly: every other Manage route requires a signed-in user.
  const assistantEnabled = useFeatureFlag('manage-assistant')
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

  // Move focus into the panel as soon as it opens, so keyboard/AT users land
  // inside the dialog rather than on whatever was focused before it opened.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    const target = getFocusableElements(panel)[0] ?? panel
    target.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeWidget()
        return
      }

      if (event.key !== 'Tab') return

      // Trap Tab/Shift+Tab within the panel's own focusable elements (close
      // button, new-tab link, iframe). The iframe is cross-origin, so once
      // focus moves inside its document, Tab handling is delegated to that
      // document and this listener no longer sees the keydown — the browser
      // takes over as usual until focus returns to the top-level document.
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
  }, [closeWidget, open])

  // The dialog is portalled outside the app root below, so the whole Manage
  // page can be removed from keyboard and screen-reader navigation while the
  // modal is open. Restore the prior state exactly on close/unmount.
  useEffect(() => {
    if (!open) return

    const appRoot = document.getElementById(MANAGE_APP_ROOT_ID)
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
  }, [open])

  useEffect(() => {
    if (!open || !assistantOrigin) return

    function handleMessage(event: MessageEvent) {
      if (event.origin !== assistantOrigin) return

      const frameWindow = iframeRef.current?.contentWindow
      if (frameWindow && event.source !== frameWindow) return

      // The iframe announces readiness once its listener exists. Re-send the
      // current context then: this handshake alone is enough to deliver the
      // context to a slow-hydrating iframe, without a timed retry burst.
      if (isManageContextReadyMessage(event.data)) {
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
  }, [apolloClient, assistantOrigin, open, sendCurrentContext, t])

  // Sends the current context once the iframe has loaded, and again whenever
  // the context itself changes (e.g. a route change while the widget stays
  // open). The `klicker:manage-context-ready` handshake above covers the
  // case where the iframe is still hydrating when this first send happens.
  useEffect(() => {
    if (!open || !frameLoaded || !assistantOrigin || !iframeRef.current) return
    sendCurrentContext()
  }, [assistantContext, assistantOrigin, frameLoaded, open, sendCurrentContext])

  if (!enabled || !assistantUrl) {
    return null
  }

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          aria-controls={MANAGE_ASSISTANT_DIALOG_ID}
          aria-expanded={open}
          aria-haspopup="dialog"
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
          <div
            id={MANAGE_ASSISTANT_DIALOG_ID}
            ref={panelRef}
            role="dialog"
            aria-modal={open ? 'true' : undefined}
            aria-hidden={!open}
            aria-label={t('manage.assistant.title')}
            inert={!open}
            tabIndex={-1}
            className={twMerge(
              'fixed bottom-0 left-0 right-0 z-40 flex h-[min(85dvh,44rem)] min-h-[28rem] w-screen flex-col overflow-hidden overscroll-contain border-t border-gray-200 bg-white shadow-2xl focus:outline-none md:inset-x-auto md:bottom-6 md:left-auto md:right-6 md:h-[min(42rem,calc(100dvh-3rem))] md:w-[28rem] md:rounded-md md:border',
              !open && 'hidden'
            )}
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
          </div>,
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

// Returns the panel's own focusable elements in DOM order (close button,
// new-tab link, iframe, ...). Deliberately shallow: it only needs to cover
// the widget's own chrome, not content inside the cross-origin iframe.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
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
