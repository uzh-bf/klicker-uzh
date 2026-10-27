import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import type { AdaptiveAttemptSummaryData } from './adaptiveAttemptCsv'

const RATINGS = ['GOOD', 'CHECK', 'UNRELIABLE', 'NOT_AVAILABLE'] as const
const REASON_CODES = [
  'PRECISION_MEDIUM',
  'PRECISION_WIDE',
  'PERSON_FIT',
  'TARGETING',
  'EDGE_CLAMP',
  'EDGE_UNMEASURED',
  'COVERAGE_LOW',
] as const

const isOneOf = <T extends string>(
  values: readonly T[],
  value: string
): value is T => (values as readonly string[]).includes(value)

const BADGE_CLASSES: Record<(typeof RATINGS)[number], string> = {
  GOOD: 'border-green-200 bg-green-50 text-green-800',
  CHECK: 'border-amber-200 bg-amber-50 text-amber-800',
  UNRELIABLE: 'border-red-200 bg-red-50 text-red-800',
  NOT_AVAILABLE: 'border-gray-200 bg-gray-50 text-gray-700',
}

function AdaptiveAttemptRating({
  rating,
  reasons,
}: {
  rating: string
  reasons: AdaptiveAttemptSummaryData['ratingReasons']
}) {
  const t = useTranslations()
  const level = isOneOf(RATINGS, rating) ? rating : 'NOT_AVAILABLE'
  return (
    <div data-cy="adaptive-attempt-rating">
      <span
        className={twMerge(
          'inline-block rounded border px-2 py-0.5 text-xs font-semibold',
          BADGE_CLASSES[level]
        )}
      >
        {t(`manage.evaluation.adaptive.attemptDiagnostics.ratings.${level}`)}
      </span>
      {reasons.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
          {reasons.flatMap((reason) => {
            const code = reason.code
            if (!isOneOf(REASON_CODES, code)) return []
            return [
              <li key={`${code}-${reason.nodeName ?? 'overall'}`}>
                {t(
                  `manage.evaluation.adaptive.attemptDiagnostics.reasons.${code}`,
                  {
                    node: reason.nodeName ?? '',
                    value:
                      code === 'TARGETING'
                        ? Math.round((reason.value ?? 0) * 100)
                        : (reason.value ?? 0),
                  }
                )}
              </li>,
            ]
          })}
        </ul>
      ) : null}
    </div>
  )
}

export default AdaptiveAttemptRating
