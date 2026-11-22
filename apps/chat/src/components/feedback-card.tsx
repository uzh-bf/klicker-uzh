'use client'

import { TextMessagePartProvider } from '@assistant-ui/react'
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  type CircleIcon,
  CopyIcon,
  LoaderCircleIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FC, useState } from 'react'
import {
  asFeedbackResult,
  type CriterionStatus,
  feedbackToText,
} from '@/src/lib/feedback'
import { MarkdownText } from './markdown-text'

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

function Quote({ text }: Readonly<{ text: string }>) {
  return (
    <q className="block border-l-2 border-slate-300 py-0.5 pl-2 text-sm italic text-slate-600 before:content-none after:content-none">
      {text}
    </q>
  )
}

/**
 * Model-written card text goes through the message renderer, so citation
 * markers, mathematics and code render as in the reply itself.
 */
function FeedbackText({ text }: Readonly<{ text: string }>) {
  return (
    <div className="text-sm [&_.aui-md>*:first-child]:mt-0 [&_.aui-md>*:last-child]:mb-0">
      <TextMessagePartProvider text={text}>
        <MarkdownText />
      </TextMessagePartProvider>
    </div>
  )
}

/**
 * A draft the server rejected, or a call whose input did not parse. The model
 * usually tries again, so the attempt belongs in the collapsed tool-call trace
 * rather than in the answer.
 */
export function isRejectedFeedback(
  result: unknown,
  isError: boolean | undefined
): boolean {
  const parsed = asFeedbackResult(result)
  return parsed?.kind === 'feedback-invalid' || (isError === true && !parsed)
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
  // Rejected drafts render as a trace row in the tool-call group instead.
  if (parsed?.kind !== 'feedback' || isError) return null

  const content = parsed.content
  const { criteria, improvements } = content
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
      improvements: t('points'),
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
      <header className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {content.summary && (
            <div className="mt-1 text-slate-600">
              <FeedbackText text={content.summary} />
            </div>
          )}
        </div>
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
                    <FeedbackText text={strength.text} />
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
                    <div className="text-slate-700">
                      <FeedbackText text={criterion.comment} />
                    </div>
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
                    <div className="text-slate-700">
                      <FeedbackText text={point.comment} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {content.nextStep && (
          <div className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <ArrowRightIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold">{t('nextStep')}</p>
              <FeedbackText text={content.nextStep} />
            </div>
          </div>
        )}
      </div>
      {/* Actions sit in the footer: floating thread controls cover the top
          corners on narrow screens. */}
      <footer className="flex justify-end border-t border-slate-100 px-2 py-1">
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-8 items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {copied ? (
            <CheckIcon className="size-3.5" aria-hidden />
          ) : (
            <CopyIcon className="size-3.5" aria-hidden />
          )}
          <span>{copied ? t('copied') : t('copy')}</span>
        </button>
      </footer>
    </section>
  )
}
