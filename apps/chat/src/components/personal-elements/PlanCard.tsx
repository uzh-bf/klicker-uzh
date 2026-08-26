'use client'

import { useAuiState } from '@assistant-ui/react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { usePersonalElementsRuntime } from './runtime-context'

type PlanPart = {
  toolCallId: string
  argsText: string
  result?: unknown
  status: { type: string }
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function PlanCard({ part }: { part: PlanPart }) {
  const t = useTranslations()
  const message = useAuiState((state) => state.message)
  const { approvePlan, getPlanStatus } = usePersonalElementsRuntime()
  const [submitting, setSubmitting] = useState(false)
  const inputPlan = useMemo(() => parseJson(part.argsText), [part.argsText])
  const resultPlan = asObject(part.result)
  const plan =
    resultPlan && Array.isArray(resultPlan.cards) ? resultPlan : inputPlan
  const messageId = message.id
  const status = getPlanStatus({ messageId, toolCallId: part.toolCallId })
  const cards = Array.isArray(plan?.cards) ? plan.cards : []
  const topic = typeof plan?.topic === 'string' ? plan.topic : ''
  const discardedDuplicates = Array.isArray(plan?.discardedDuplicates)
    ? plan.discardedDuplicates.filter(
        (value): value is { title: string } =>
          !!value &&
          typeof value === 'object' &&
          typeof (value as { title?: unknown }).title === 'string'
      )
    : []
  const allDuplicates = plan?.status === 'all_duplicates'

  if (status === 'superseded') {
    return (
      <div className="text-muted-foreground rounded border px-3 py-2 text-sm">
        {t('chat.personalElements.superseded')}
      </div>
    )
  }

  return (
    <section
      className="bg-muted/30 my-2 rounded-lg border p-3"
      data-cy="card-plan"
    >
      <h3 className="font-semibold">{t('chat.personalElements.planTitle')}</h3>
      {topic ? (
        <p className="text-muted-foreground mt-1 text-sm">{topic}</p>
      ) : null}
      {cards.length > 0 ? (
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
          {cards.map((card, index) => {
            const value = card && typeof card === 'object' ? card : null
            const title =
              value && 'title' in value && typeof value.title === 'string'
                ? value.title
                : t('chat.personalElements.cardNumber', { number: index + 1 })
            const key =
              value &&
              'candidateId' in value &&
              typeof value.candidateId === 'string'
                ? value.candidateId
                : title
            return <li key={`${key}-${index}`}>{title}</li>
          })}
        </ol>
      ) : null}
      {discardedDuplicates.length > 0 ? (
        <div
          className="text-muted-foreground mt-3 text-sm"
          data-cy="card-plan-duplicates"
          role="status"
        >
          <p>{t('chat.personalElements.duplicatesSkipped')}</p>
          <ul className="mt-1 list-inside list-disc">
            {discardedDuplicates.map((duplicate, index) => (
              <li key={`${duplicate.title}-${index}`}>{duplicate.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {allDuplicates ? (
        <p
          className="text-muted-foreground mt-3 text-sm font-medium"
          data-cy="card-plan-all-duplicates"
          role="status"
        >
          {t('chat.personalElements.allDuplicates')}
        </p>
      ) : status === 'accepted' ? (
        <p
          className="text-muted-foreground mt-3 text-sm font-medium"
          data-cy="card-plan-accepted"
          role="status"
        >
          {t('chat.personalElements.accepted')}
        </p>
      ) : (
        <button
          type="button"
          disabled={submitting || part.status.type === 'running'}
          onClick={() => {
            setSubmitting(true)
            void approvePlan(
              { messageId, toolCallId: part.toolCallId },
              t('chat.personalElements.approvalMessage', { topic })
            ).finally(() => setSubmitting(false))
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 min-h-10 rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting
            ? t('chat.personalElements.generating')
            : t('chat.personalElements.approve')}
        </button>
      )}
    </section>
  )
}
