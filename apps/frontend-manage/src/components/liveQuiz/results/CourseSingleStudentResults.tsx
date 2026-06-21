import {
  faArrowRight,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Tooltip, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import Link from 'next/link'
import { trpc } from '../../../lib/trpc'

function CourseSingleStudentResults({
  courseId,
  participantId,
}: {
  courseId: string
  participantId: string
}) {
  const t = useTranslations()
  const formatter = useFormatter()

  const { data, error, isLoading } =
    trpc.activity.studentCourseResults.useQuery(
      { courseId, participantId },
      { enabled: Boolean(courseId && participantId) }
    )
  const studentCourseResults = data?.studentCourseResults

  if (isLoading && !studentCourseResults) {
    return <Loader />
  }

  if (error && !studentCourseResults) {
    return (
      <UserNotification
        type="error"
        message={t('manage.assessment.errorLoadingCourseResults')}
      />
    )
  }

  if (!studentCourseResults) {
    return (
      <UserNotification
        type="warning"
        message={t('manage.assessment.errorLoadingCourseResults')}
      />
    )
  }

  if (studentCourseResults.length === 0) {
    return (
      <UserNotification
        type="info"
        message={t('pwa.assessment.noCompletedLiveQuizzesYet')}
      />
    )
  }

  const formatNumber = (value: number, includeSign?: boolean) => {
    const formattedValue = formatter.number(value, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    })

    return !includeSign
      ? formattedValue
      : value >= 0
        ? `+ ${formattedValue}`
        : `- ${formattedValue.replace('-', '')}`
  }

  return (
    <div className="space-y-3">
      {studentCourseResults.map((result) => (
        <div
          key={result.id}
          className="bg-background rounded-md border border-slate-200 p-3 shadow-sm"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="line-clamp-2 leading-tight">
                {result.displayName}
              </span>
              {result.corrections && result.corrections.length > 0 ? (
                <Tooltip
                  tooltip={
                    <div className="text-sm">
                      <div className="mb-2 font-semibold">
                        {t('manage.course.pointCorrections')}
                      </div>
                      <ul className="list-disc space-y-1 pl-4">
                        {result.corrections.map((correction) => {
                          const baseCorrection =
                            (correction.awardedBasePoints ?? 0) -
                            (correction.deductedBasePoints ?? 0)
                          const correctnessCorrection =
                            (correction.awardedCorrectnessPoints ?? 0) -
                            (correction.deductedCorrectnessPoints ?? 0)
                          const bonusCorrection =
                            (correction.awardedBonusPoints ?? 0) -
                            (correction.deductedBonusPoints ?? 0)
                          const totalCorrection =
                            baseCorrection +
                            correctnessCorrection +
                            bonusCorrection

                          if (
                            baseCorrection === 0 &&
                            correctnessCorrection === 0 &&
                            bonusCorrection === 0
                          ) {
                            return (
                              <li key={`correction-${correction.id}`}>
                                {t('pwa.assessment.noPointsCorrection', {
                                  reason:
                                    correction.lecturerReason ??
                                    correction.studentReason,
                                })}
                              </li>
                            )
                          }

                          return (
                            <li key={`correction-${correction.id}`}>
                              {t('pwa.assessment.nonZeroPointCorrection', {
                                points: formatNumber(totalCorrection, true),
                                basePoints: formatNumber(baseCorrection, true),
                                correctnessPoints: formatNumber(
                                  correctnessCorrection,
                                  true
                                ),
                                bonusPoints: formatNumber(
                                  bonusCorrection,
                                  true
                                ),
                                reason:
                                  correction.lecturerReason ??
                                  correction.studentReason,
                              })}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  }
                >
                  <FontAwesomeIcon
                    className="text-uzh-red-100"
                    icon={faTriangleExclamation}
                  />
                </Tooltip>
              ) : null}
            </div>
            <div className="text-muted-foreground text-xs">
              {t('pwa.assessment.completedOn', {
                date: formatter.dateTime(new Date(result.finishedAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            {[
              {
                key: 'base',
                label: t('pwa.assessment.basePoints'),
                achieved: result.basePoints,
                available: result.availableBasePoints,
              },
              {
                key: 'correctness',
                label: t('pwa.assessment.correctnessPoints'),
                achieved: result.correctnessPoints,
                available: result.availableCorrectnessPoints,
              },
              {
                key: 'bonus',
                label: t('pwa.assessment.bonusPoints'),
                achieved: result.bonusPoints,
                available: result.availableBonusPoints,
              },
            ].map((entry) => (
              <div
                key={entry.key}
                className="bg-muted/50 rounded border border-slate-100 px-2 py-1"
              >
                <div className="text-muted-foreground text-[0.65rem] uppercase tracking-wide">
                  {entry.label}
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-medium">
                    {formatNumber(entry.achieved)}
                  </span>
                  <span className="text-muted-foreground text-[0.65rem]">
                    {`/ ${formatNumber(entry.available)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <Link
            className="text-primary-100 mt-2.5 flex items-center justify-end text-sm hover:underline"
            href={`/courses/${courseId}/assessment/liveQuiz/${result.activityId}?participantId=${participantId}`}
          >
            <FontAwesomeIcon icon={faArrowRight} className="mr-1.5" />
            <span>{t('manage.assessment.detailedResultsLiveQuiz')}</span>
          </Link>
        </div>
      ))}
    </div>
  )
}

export default CourseSingleStudentResults
