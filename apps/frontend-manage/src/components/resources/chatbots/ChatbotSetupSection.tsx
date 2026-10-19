import { faCircle as faCircleOutline } from '@fortawesome/free-regular-svg-icons'
import {
  faChevronDown,
  faCircle,
  faCircleCheck,
  faCircleExclamation,
  faClock,
  faTriangleExclamation,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { type ReactNode, useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { ChatbotSetupSectionStatus } from './chatbotSetupStatus'

const statusStyles: Record<
  ChatbotSetupSectionStatus,
  { icon: IconDefinition; iconClass: string }
> = {
  default: {
    icon: faCircleOutline,
    iconClass: 'text-gray-400',
  },
  suggested: {
    icon: faCircleCheck,
    iconClass: 'text-green-600',
  },
  saved: {
    icon: faCircleCheck,
    iconClass: 'text-green-600',
  },
  warning: {
    icon: faTriangleExclamation,
    iconClass: 'text-amber-500',
  },
  invalid: {
    icon: faCircleExclamation,
    iconClass: 'text-red-600',
  },
  unsaved: {
    icon: faCircle,
    iconClass: 'text-blue-600',
  },
  notSubmitted: {
    icon: faClock,
    iconClass: 'text-slate-500',
  },
}

export type ChatbotSetupSectionFooter = {
  onSave: () => void
  saveDisabled: boolean
  saving: boolean
  // Restores the saved values. Shown only while the section has unsaved edits.
  onDiscard?: () => void
  dirty: boolean
}

// One setting area of the chatbot setup page. A closed section shows its
// status and a short summary; an open one shows its editor and a single Save.
// The editor stays mounted after the first opening, so closing a section keeps
// its unsaved edits.
function ChatbotSetupSection({
  id,
  title,
  status,
  summary,
  open,
  onOpenChange,
  headerAction,
  footer,
  children,
}: {
  id: string
  title: string
  status: ChatbotSetupSectionStatus
  summary: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  // A secondary action next to the header, such as a preview link.
  headerAction?: ReactNode
  footer?: ChatbotSetupSectionFooter
  children: ReactNode
}) {
  const t = useTranslations()
  const contentId = useId()
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const style = statusStyles[status]
  const statusLabels: Record<ChatbotSetupSectionStatus, string> = {
    default: t('manage.resources.chatbotSectionStatusDefault'),
    suggested: t('manage.resources.chatbotSectionStatusSuggested'),
    saved: t('manage.resources.chatbotSectionStatusSaved'),
    warning: t('manage.resources.chatbotSectionStatusWarning'),
    invalid: t('manage.resources.chatbotSectionStatusInvalid'),
    unsaved: t('manage.resources.chatbotSectionStatusUnsaved'),
    notSubmitted: t('manage.resources.chatbotSectionStatusNotSubmitted'),
  }
  const statusLabel = statusLabels[status]

  return (
    <section
      id={`chatbot-section-${id}`}
      className="scroll-mt-4 rounded-lg border border-gray-200 bg-white"
      data-cy={`chatbot-section-${id}`}
      data-status={status}
    >
      {/* The toggle covers the whole header row; a header action sits above
          it so it stays clickable on its own. */}
      <div className="relative flex items-start gap-3 p-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-start gap-3 text-left after:absolute after:inset-0 after:rounded-lg after:content-['']"
          onClick={() => onOpenChange(!open)}
          data-cy={`chatbot-section-${id}-toggle`}
        >
          <FontAwesomeIcon
            icon={style.icon}
            className={twMerge('mt-1 h-4 w-4 shrink-0', style.iconClass)}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-gray-900">{title}</span>
              <span
                className="text-xs font-medium text-gray-500"
                data-cy={`chatbot-section-${id}-status`}
              >
                {statusLabel}
              </span>
            </span>
            <span
              className="mt-1 block text-sm text-gray-600"
              data-cy={`chatbot-section-${id}-summary`}
            >
              {summary}
            </span>
          </span>
        </button>
        {headerAction ? (
          <div className="relative z-10 shrink-0">{headerAction}</div>
        ) : null}
        <FontAwesomeIcon
          icon={faChevronDown}
          className={twMerge(
            'pointer-events-none mt-1.5 h-3 w-3 shrink-0 text-gray-500 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </div>
      {mounted ? (
        <div
          id={contentId}
          hidden={!open}
          className="space-y-4 border-t border-gray-200 p-4"
        >
          {children}
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-4 pt-2">
              {footer.dirty && footer.onDiscard ? (
                <button
                  type="button"
                  className="text-sm text-gray-600 underline-offset-2 hover:underline disabled:opacity-50"
                  disabled={footer.saving}
                  onClick={footer.onDiscard}
                  data-cy={`chatbot-section-${id}-discard`}
                >
                  {t('manage.resources.chatbotSectionDiscard')}
                </button>
              ) : null}
              <Button
                primary
                type="button"
                loading={footer.saving}
                disabled={footer.saveDisabled}
                onClick={footer.onSave}
                data={{ cy: `chatbot-section-${id}-save` }}
              >
                <Button.Label>
                  {footer.saving
                    ? t('manage.resources.chatbotSectionSaving')
                    : t('manage.resources.chatbotSectionSave')}
                </Button.Label>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default ChatbotSetupSection
