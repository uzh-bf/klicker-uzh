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

export function ManageAssistantWidget() {
  const t = useTranslations()
  const router = useRouter()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const [open, setOpen] = useState(false)

  const enabled = isManageAssistantEnabled(
    process.env.NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED
  )
  const assistantUrl = useMemo(
    () =>
      buildManageAssistantUrl({
        chatUrl: process.env.NEXT_PUBLIC_CHAT_URL,
        locale: router.locale,
        returnTo: router.asPath,
      }),
    [router.asPath, router.locale]
  )

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
          onClick={() => setOpen(true)}
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
          className="fixed inset-x-0 bottom-0 z-40 flex h-[min(85dvh,44rem)] min-h-[28rem] flex-col overflow-hidden border-t border-gray-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:h-[min(42rem,calc(100dvh-3rem))] md:w-[28rem] md:rounded-md md:border"
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
              src={assistantUrl}
              title={t('manage.assistant.title')}
              className="h-full min-h-[24rem] w-full border-0"
              data-cy="manage-assistant-frame"
            />
          </div>
        </aside>
      )}
    </>
  )
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
