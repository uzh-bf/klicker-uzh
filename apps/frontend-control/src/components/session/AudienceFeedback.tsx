import { useMutation } from '@apollo/client'
import {
  faChevronRight,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeLiveQuizSettingsDocument,
  type GetControlLiveQuizFeedbacksQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Switch, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ResponsiveSheet from '../common/ResponsiveSheet'
import {
  cardClass,
  outlineButtonClass,
  sheetButtonClass,
} from '../common/styles'

type FeedbackData = NonNullable<
  GetControlLiveQuizFeedbacksQuery['controlLiveQuizFeedbacks']
>

interface AudienceFeedbackProps {
  quizId: string
  data?: FeedbackData | null
  loading: boolean
  error?: Error
  refetch: () => Promise<unknown>
}

const SCALE_MIN = -2
const SCALE_MAX = 2

function clampScale(value: number) {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, value))
}

function meterValue(value: number | null | undefined, hasResponses: boolean) {
  if (!hasResponses || typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return clampScale(value)
}

function FeedbackMeter({
  label,
  value,
  lowLabel,
  centerLabel,
  highLabel,
  dataCy,
}: {
  label: string
  value: number
  lowLabel: string
  centerLabel: string
  highLabel: string
  dataCy: string
}) {
  const t = useTranslations()
  const valueLabel =
    value < -2 / 3 ? lowLabel : value > 2 / 3 ? highLabel : centerLabel
  const position = ((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100

  return (
    <div>
      <div className="text-ctrl-ink flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span>{valueLabel}</span>
      </div>
      <div
        role="meter"
        aria-label={t('control.liveQuiz.audienceFeedbackMeterLabel', {
          dimension: label,
          value: valueLabel,
        })}
        aria-valuemin={SCALE_MIN}
        aria-valuemax={SCALE_MAX}
        aria-valuenow={value}
        aria-valuetext={valueLabel}
        data-cy={dataCy}
        className="bg-ctrl-hair relative mt-2 h-2.5 rounded-full"
      >
        <span className="bg-ctrl-faint absolute top-0 bottom-0 left-1/2 w-px" />
        <span
          className="bg-uzh-blue ring-ctrl-border absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
          style={{ left: `${position}%` }}
        />
      </div>
      <div
        aria-hidden
        className="text-ctrl-muted mt-1 grid grid-cols-3 text-[11px] font-semibold"
      >
        <span>{lowLabel}</span>
        <span className="text-center">{centerLabel}</span>
        <span className="text-right">{highLabel}</span>
      </div>
    </div>
  )
}

// Compact status strip and responsive detail sheet for the recent confusion
// feedback. The polled query data remains visible while a refresh is failing.
function AudienceFeedback({
  quizId,
  data,
  loading,
  error,
  refetch,
}: AudienceFeedbackProps) {
  const t = useTranslations()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [updatingConfusionFeedback, setUpdatingConfusionFeedback] =
    useState(false)
  const [changeSettings] = useMutation(ChangeLiveQuizSettingsDocument)

  const rawCount = data?.confusionSummary?.numberOfParticipants
  const responseCount =
    typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : null
  const hasResponses = responseCount !== null && responseCount > 0
  const speed = meterValue(data?.confusionSummary?.speed, hasResponses)
  const difficulty = meterValue(
    data?.confusionSummary?.difficulty,
    hasResponses
  )
  const disabled = data ? !data.isConfusionFeedbackEnabled : false

  const speedLabel =
    speed === null
      ? null
      : speed < -2 / 3
        ? t('control.liveQuiz.audienceFeedbackSpeedLow')
        : speed > 2 / 3
          ? t('control.liveQuiz.audienceFeedbackSpeedHigh')
          : t('control.liveQuiz.audienceFeedbackSpeedCenter')
  const difficultyLabel =
    difficulty === null
      ? null
      : difficulty < -2 / 3
        ? t('control.liveQuiz.audienceFeedbackDifficultyLow')
        : difficulty > 2 / 3
          ? t('control.liveQuiz.audienceFeedbackDifficultyHigh')
          : t('control.liveQuiz.audienceFeedbackDifficultyCenter')

  const loadFailed = !data && !!error
  const refreshFailed = !!data && !!error
  const initialLoading = loading && !data
  const unavailable = !data && !loading && !loadFailed
  const summaryState = initialLoading
    ? 'loading'
    : loadFailed || unavailable
      ? 'error'
      : refreshFailed
        ? 'stale'
        : loading
          ? 'loading'
          : disabled
            ? 'off'
            : hasResponses
              ? 'ready'
              : 'empty'
  const statusMessage = initialLoading
    ? t('control.liveQuiz.audienceFeedbackLoading')
    : loadFailed || unavailable
      ? t('control.liveQuiz.audienceFeedbackLoadError')
      : refreshFailed
        ? t('control.liveQuiz.audienceFeedbackRefreshError')
        : t('control.liveQuiz.audienceFeedbackWindow')

  const updateConfusionFeedback = async (isEnabled: boolean) => {
    setUpdatingConfusionFeedback(true)
    try {
      const result = await changeSettings({
        // send only the setting controlled here; omitted settings stay intact
        variables: { id: quizId, isConfusionFeedbackEnabled: isEnabled },
      })
      if (!result.data?.changeLiveQuizSettings) {
        throw new Error('confusion feedback setting was not updated')
      }
      await refetch()
    } catch {
      toast({
        type: 'error',
        message: t('control.liveQuiz.actionFailed'),
        options: { duration: 5000 },
      })
    } finally {
      setUpdatingConfusionFeedback(false)
    }
  }

  return (
    <>
      <div className={twMerge(cardClass, 'mt-3 overflow-hidden')}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-busy={loading || updatingConfusionFeedback}
          aria-label={t('control.liveQuiz.audienceFeedbackOpen')}
          data-cy="audience-feedback-summary"
          data-state={summaryState}
          className="hover:bg-ctrl-bg focus-visible:ring-uzh-blue w-full rounded-md px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span className="flex items-center gap-2">
            <span className="text-ctrl-ink flex-1 text-[15px] font-bold">
              {t('control.liveQuiz.audienceFeedbackTitle')}
            </span>
            {disabled && (
              <span className="bg-ctrl-hair text-ctrl-muted rounded px-1.5 py-0.5 text-xs font-semibold">
                {t('control.liveQuiz.audienceFeedbackOff')}
              </span>
            )}
            <FontAwesomeIcon
              icon={faChevronRight}
              className="text-ctrl-muted h-3.5 w-3.5"
            />
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {hasResponses && speedLabel && difficultyLabel ? (
              <>
                <span className="text-ctrl-muted">
                  {t('control.liveQuiz.audienceFeedbackSpeed')}
                </span>
                <span className="text-ctrl-ink font-semibold">
                  {speedLabel}
                </span>
                <span aria-hidden className="text-ctrl-faint">
                  ·
                </span>
                <span className="text-ctrl-muted">
                  {t('control.liveQuiz.audienceFeedbackDifficulty')}
                </span>
                <span className="text-ctrl-ink font-semibold">
                  {difficultyLabel}
                </span>
              </>
            ) : null}
            <span
              className="text-ctrl-ink ml-auto font-semibold tabular-nums"
              data-cy="audience-feedback-count"
            >
              <span
                data-cy={
                  summaryState === 'empty'
                    ? 'audience-feedback-empty'
                    : undefined
                }
              >
                {initialLoading
                  ? '…'
                  : loadFailed || unavailable
                    ? '—'
                    : hasResponses
                      ? t('control.liveQuiz.audienceFeedbackCount', {
                          count: responseCount ?? 0,
                        })
                      : t('control.liveQuiz.audienceFeedbackNoResponses')}
              </span>
            </span>
          </span>

          <span
            role={refreshFailed || loadFailed ? 'alert' : 'status'}
            aria-live="polite"
            data-cy="audience-feedback-status"
            className={twMerge(
              'mt-0.5 flex items-center gap-1.5 text-[13px]',
              refreshFailed || loadFailed || unavailable
                ? 'text-uzh-red font-semibold'
                : 'text-ctrl-muted'
            )}
          >
            {(refreshFailed || loadFailed || unavailable) && (
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="h-3.5 w-3.5 shrink-0"
              />
            )}
            {statusMessage}
          </span>
        </button>
      </div>

      <ResponsiveSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('control.liveQuiz.audienceFeedbackTitle')}
        dataCy="audience-feedback-sheet"
        actions={
          <Button
            onClick={() => setSheetOpen(false)}
            className={{ root: `${sheetButtonClass} ${outlineButtonClass}` }}
            data={{ cy: 'close-audience-feedback' }}
          >
            {t('shared.generic.close')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-ctrl-muted text-sm">
            {t('control.liveQuiz.audienceFeedbackSheetHint')}
          </p>

          {initialLoading ? (
            <p
              role="status"
              className="bg-ctrl-bg text-ctrl-muted rounded-md p-3 text-sm"
            >
              {t('control.liveQuiz.audienceFeedbackLoading')}
            </p>
          ) : loadFailed || unavailable ? (
            <p role="alert" className="text-uzh-red text-sm font-semibold">
              {t('control.liveQuiz.audienceFeedbackLoadError')}
            </p>
          ) : null}

          {refreshFailed && (
            <p
              role="alert"
              className="text-uzh-red flex items-start gap-2 text-sm font-semibold"
            >
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              {t('control.liveQuiz.audienceFeedbackRefreshError')}
            </p>
          )}

          {data && !initialLoading && !loadFailed ? (
            hasResponses && speed !== null && difficulty !== null ? (
              <div
                className="flex flex-col gap-4"
                data-cy="audience-feedback-meters"
              >
                <FeedbackMeter
                  label={t('control.liveQuiz.audienceFeedbackSpeed')}
                  value={speed}
                  lowLabel={t('control.liveQuiz.audienceFeedbackSpeedLow')}
                  centerLabel={t(
                    'control.liveQuiz.audienceFeedbackSpeedCenter'
                  )}
                  highLabel={t('control.liveQuiz.audienceFeedbackSpeedHigh')}
                  dataCy="audience-feedback-speed-meter"
                />
                <FeedbackMeter
                  label={t('control.liveQuiz.audienceFeedbackDifficulty')}
                  value={difficulty}
                  lowLabel={t('control.liveQuiz.audienceFeedbackDifficultyLow')}
                  centerLabel={t(
                    'control.liveQuiz.audienceFeedbackDifficultyCenter'
                  )}
                  highLabel={t(
                    'control.liveQuiz.audienceFeedbackDifficultyHigh'
                  )}
                  dataCy="audience-feedback-difficulty-meter"
                />
                <p
                  className="text-ctrl-ink text-sm font-semibold tabular-nums"
                  data-cy="audience-feedback-sheet-count"
                >
                  {t('control.liveQuiz.audienceFeedbackCount', {
                    count: responseCount ?? 0,
                  })}
                  <span className="text-ctrl-muted font-normal">
                    {' · '}
                    {t('control.liveQuiz.audienceFeedbackWindow')}
                  </span>
                </p>
              </div>
            ) : (
              <p className="bg-ctrl-bg text-ctrl-muted rounded-md p-3 text-sm">
                {t('control.liveQuiz.audienceFeedbackNoResponses')}
              </p>
            )
          ) : null}

          <div className="border-ctrl-border border-t pt-4">
            <Switch
              checked={data?.isConfusionFeedbackEnabled ?? false}
              disabled={!data || updatingConfusionFeedback}
              onCheckedChange={(value) => void updateConfusionFeedback(value)}
              label={t('control.liveQuiz.audienceFeedbackToggle')}
              data={{ cy: 'audience-feedback-toggle' }}
            />
            {data && (
              <p className="text-ctrl-muted mt-1 text-[13px]">
                {data.isConfusionFeedbackEnabled
                  ? t('control.liveQuiz.audienceFeedbackToggleOnHint')
                  : t('control.liveQuiz.audienceFeedbackToggleOffHint')}
              </p>
            )}
          </div>
        </div>
      </ResponsiveSheet>
    </>
  )
}

export default AudienceFeedback
