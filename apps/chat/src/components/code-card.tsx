'use client'

import type { CodeProfile } from '@klicker-uzh/code-runner'
import { CodeRunner, useCodeLanguageName } from '@klicker-uzh/code-runner/react'
import { AlertCircleIcon, LoaderCircleIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId } from 'react'
import { parseCodeCardResult } from '@/src/lib/code-runner/cardResult'
import { resolveSelectedMode } from '@/src/lib/config/modes'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { useEffectiveModeOptions } from './mode-options-context'

export function CodeCard({
  result,
  status,
}: {
  result: unknown
  status: { type: string }
}) {
  const t = useTranslations()
  const card = parseCodeCardResult(result)

  if (status.type === 'running' && !card) {
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
        {t('chat.codeCard.opening')}
      </div>
    )
  }
  if (!card) {
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <AlertCircleIcon aria-hidden className="size-4" />
        {t('chat.codeCard.invalid')}
      </div>
    )
  }
  return (
    <ParsedCodeCard profile={card.profile} starterCode={card.starterCode} />
  )
}

function ParsedCodeCard({
  profile,
  starterCode,
}: {
  profile: CodeProfile
  starterCode: string
}) {
  const t = useTranslations()
  const titleId = useId()
  const language = useCodeLanguageName(profile)
  // The host's effective mode options, so owner preview admits exactly what
  // learners get.
  const modeOptions = useEffectiveModeOptions()
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const admitted =
    modeOptions[
      resolveSelectedMode(modeOptions, selectedMode)
    ]?.codeProfiles?.includes(profile) ?? false

  return (
    <section
      aria-labelledby={titleId}
      className="my-3 w-full space-y-3 rounded-md border border-slate-200 bg-white p-4 text-slate-950"
      data-cy="code-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" id={titleId}>
          {t('chat.codeCard.title')}
        </h3>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {language}
        </span>
      </div>
      <CodeRunner
        blockedNotice={admitted ? undefined : t('chat.codeCard.notAdmitted')}
        profile={profile}
        starterCode={starterCode}
      />
      <p className="text-xs text-slate-500">{t('chat.codeCard.localNote')}</p>
    </section>
  )
}
