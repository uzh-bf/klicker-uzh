'use client'

import type { ELearningSnapshotContent } from '@klicker-uzh/types'
import { useTranslations } from 'next-intl'
import type { FC } from 'react'

// Client-side shape read for the persisted learning-context snapshot. The
// server verifies the envelope before persistence; this only decides whether
// a card can be rendered at all.
type LearningContextMessage = {
  metadata?: { custom?: unknown } | null | undefined
}

export function readLearningContext(
  message: LearningContextMessage
): Partial<ELearningSnapshotContent> | null {
  const custom = message.metadata?.custom
  const value =
    custom && typeof custom === 'object'
      ? (custom as { learningContext?: unknown }).learningContext
      : undefined
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<ELearningSnapshotContent>
  if (typeof snapshot.snapshotId !== 'string') return null
  if (!snapshot.location || !snapshot.material) return null
  return snapshot
}

const LearningContextCard: FC<{ message: LearningContextMessage }> = ({
  message,
}) => {
  const t = useTranslations('chat.thread.learningContext')
  const snapshot = readLearningContext(message)
  if (!snapshot) return null

  const location = snapshot.location!
  const material = snapshot.material!
  const labels = location.labels
  const locationParts = [
    labels?.course,
    labels?.module,
    labels?.unit,
    labels?.block,
  ]
    .filter(Boolean)
    .join(' > ')
  const locationLabel = locationParts || location.title
  const completionLabels = {
    confirmed_complete: t('completion.confirmed_complete'),
    pending: t('completion.pending'),
    incomplete: t('completion.incomplete'),
    unavailable: t('completion.unavailable'),
  }
  const completionKey = snapshot.completion?.unitState
  const completionLabel = completionKey ? completionLabels[completionKey] : null
  const availabilityLabels = {
    'full-text': t('availability.full-text'),
    metadata: t('availability.metadata'),
    unavailable: t('availability.unavailable'),
    unknown: t('availability.unknown'),
  }
  const observedAtLabel = snapshot.observedAt
    ? new Date(snapshot.observedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null
  const excerptPreview = material.excerpt
    ? material.excerpt.slice(0, 200) +
      (material.excerpt.length > 200 ? '…' : '')
    : null

  return (
    <details
      data-cy="chat-learning-context"
      className="border-input bg-canvas-muted max-w-[80%] rounded-lg border px-3 py-1.5 text-xs"
    >
      <summary className="text-muted-foreground cursor-pointer list-none select-none">
        {t('summary')}
      </summary>
      <dl className="mt-1.5 flex flex-col gap-1">
        {locationLabel && (
          <div>
            <dt className="sr-only">{t('location')}</dt>
            <dd className="font-medium">{locationLabel}</dd>
          </div>
        )}
        {observedAtLabel && (
          <div>
            <dt className="sr-only">{t('observed')}</dt>
            <dd className="text-muted-foreground">{observedAtLabel}</dd>
          </div>
        )}
        {completionLabel && (
          <div>
            <dt className="sr-only">{t('completionLabel')}</dt>
            <dd>
              {t('completionLabel')}: {completionLabel}
            </dd>
          </div>
        )}
        <div>
          <dt className="sr-only">{t('evidence')}</dt>
          <dd className="text-muted-foreground">
            {availabilityLabels[material.availability]}
            {material.excerptTruncated ? " + ' · ' + " : ''}
          </dd>
        </div>
        {excerptPreview && <dd className="italic">{excerptPreview}</dd>}
      </dl>
    </details>
  )
}

export default LearningContextCard
