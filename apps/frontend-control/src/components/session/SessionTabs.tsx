import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

export type SessionTab = 'control' | 'qa' | 'stats'

interface SessionTabsProps {
  tab: SessionTab
  onChange: (tab: SessionTab) => void
  // questions waiting for moderation, shown as a red counter on the Q&A tab
  pendingQuestions: number
}

function SessionTabs({ tab, onChange, pendingQuestions }: SessionTabsProps) {
  const t = useTranslations()
  const tabs: { id: SessionTab; label: string }[] = [
    { id: 'control', label: t('control.liveQuiz.tabControl') },
    { id: 'qa', label: t('control.liveQuiz.tabQA') },
    { id: 'stats', label: t('control.liveQuiz.tabStats') },
  ]

  return (
    <div
      role="tablist"
      className="bg-ctrl-hair mt-3.5 flex gap-1 rounded-md p-[3px]"
    >
      {tabs.map((entry) => {
        const active = entry.id === tab
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(entry.id)}
            data-cy={`session-tab-${entry.id}`}
            className={twMerge(
              'text-ctrl-ink-2 flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded text-sm font-semibold',
              active && 'shadow-ctrl text-uzh-blue bg-white'
            )}
          >
            <span>{entry.label}</span>
            {entry.id === 'qa' && pendingQuestions > 0 && (
              <span
                className="bg-uzh-red inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[11px] font-bold text-white"
                data-cy="session-tab-qa-pending"
              >
                <span aria-hidden>{pendingQuestions}</span>
                <span className="sr-only">
                  {t('control.liveQuiz.qaPendingCount', {
                    count: pendingQuestions,
                  })}
                </span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default SessionTabs
