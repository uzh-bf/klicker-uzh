'use client'

import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  type CircleIcon,
  CopyIcon,
  LoaderCircleIcon,
  WrenchIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FC, useState } from 'react'
import {
  asFeedbackResult,
  type CriterionStatus,
  feedbackToText,
  splitFeedbackPoints,
} from '@/src/lib/feedback'

const STATUS_STYLE: Record<
  CriterionStatus,
  { icon: typeof CircleIcon; className: string }
> = {
  met: {
    icon: CircleCheckIcon,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  partial: {
    icon: CircleDotIcon,
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  missing: {
    icon: CircleDashedIcon,
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
}

function Quote({ text }: { text: string }) {
  return (
    <q className="block border-l-2 border-slate-300 py-0.5 pl-2 text-sm italic text-slate-600 before:content-none after:content-none">
      {text}
    </q>
  )
}

interface FeedbackCardProps {
  result?: unknown
  status: { type: string }
  isError?: boolean
}

export const FeedbackCard: FC<FeedbackCardProps> = ({
  result,
  status,
  isError,
}) => {
  const t = useTranslations('chat.thread.feedback')
  const [copied, setCopied] = useState(false)
  const parsed = asFeedbackResult(result)

  if (status.type === 'running' && !parsed)
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        <span>{t('preparing')}</span>
      </div>
    )
  // A rejected draft: the model usually repairs it, otherwise answers in text.
  if (parsed?.kind !== 'feedback' || isError)
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
        <WrenchIcon className="size-4" aria-hidden />
        <span>{t('rejected')}</span>
      </div>
    )

  const content = parsed.content
  const { criteria, improvements } = splitFeedbackPoints(content.points)
  const title = content.title || t('fallbackTitle')
  const statusLabels: Record<CriterionStatus, string> = {
    met: t('status.met'),
    partial: t('status.partial'),
    missing: t('status.missing'),
  }
  const copy = () => {
    const text = feedbackToText(content, {
      strengths: t('strengths'),
      criteria: t('criteria'),
      points: t('points'),
      nextStep: t('nextStep'),
      status: statusLabels,
    })
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <section
      aria-label={title}
      className="my-3 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {content.summary && (
            <p className="mt-1 text-sm text-slate-600">{content.summary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? t('copied') : t('copy')}
          className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          {copied ? (
            <CheckIcon className="size-3.5" aria-hidden />
          ) : (
            <CopyIcon className="size-3.5" aria-hidden />
          )}
          <span className="hidden sm:inline">
            {copied ? t('copied') : t('copy')}
          </span>
        </button>
      </header>

      <div className="space-y-4 px-4 py-3">
        {content.strengths.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('strengths')}
            </h4>
            <ul className="space-y-2">
              {content.strengths.map((strength) => (
                <li
                  key={strength.text}
                  className="flex gap-2 text-sm text-slate-800"
                >
                  <CheckIcon
                    className="mt-0.5 size-4 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                  <div className="min-w-0 space-y-1">
                    <p>{strength.text}</p>
                    {strength.quote && <Quote text={strength.quote} />}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {criteria.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('criteria')}
            </h4>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {criteria.map((criterion) => {
                const style = STATUS_STYLE[criterion.status]
                const StatusIcon = style.icon
                return (
                  <li
                    key={`${criterion.label}:${criterion.comment}`}
                    className="space-y-1 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {criterion.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${style.className}`}
                      >
                        <StatusIcon className="size-3" aria-hidden />
                        {statusLabels[criterion.status]}
                      </span>
                    </div>
                    {criterion.quote && <Quote text={criterion.quote} />}
                    <p className="text-sm text-slate-700">
                      {criterion.comment}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {improvements.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('points')}
            </h4>
            <ol className="space-y-3">
              {improvements.map((point, index) => (
                <li
                  key={`${point.label}:${point.comment}`}
                  className="flex gap-3"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {point.label}
                    </span>
                    {point.quote && <Quote text={point.quote} />}
                    <p className="text-sm text-slate-700">{point.comment}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <ArrowRightIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">{t('nextStep')}: </span>
            {content.nextStep}
          </p>
        </div>
      </div>
    </section>
  )
}
