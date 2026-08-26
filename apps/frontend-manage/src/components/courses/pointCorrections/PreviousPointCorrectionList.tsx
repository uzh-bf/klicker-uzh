import {
  PointCorrection,
  PointCorrectionType,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'

function InfoBlock({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`gap-0.25 flex flex-col ${className ?? ''}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  )
}

function PreviousPointCorrectionList({
  corrections,
}: {
  corrections: (Omit<
    PointCorrection,
    'correctedBy' | 'instance' | 'liveQuiz' | 'participant' | 'participants'
  > & {
    correctedBy?: Pick<User, 'id' | 'shortname'> | null
    instance?: { elementData?: { name?: string } } | null
    liveQuiz?: { id: string; name: string } | null
    participant?: { id: string; email?: string | null; username: string } | null
    participants?:
      | { id: string; email?: string | null; username: string }[]
      | null
  })[]
}) {
  const t = useTranslations()

  return (
    <ul className="flex flex-col gap-3 text-sm text-gray-700">
      {corrections.map((correction) => {
        const lecturerReason = correction.reason?.trim()
        const studentReason = correction.studentReason?.trim()
        const pointAdjustments = [
          ...(typeof correction.basePoints === 'boolean'
            ? [
                t(
                  correction.basePoints
                    ? 'manage.pointCorrections.summaryAdjustmentBaseAward'
                    : 'manage.pointCorrections.summaryAdjustmentBaseDeduct'
                ),
              ]
            : []),
          ...(typeof correction.correctnessPoints === 'boolean'
            ? [
                t(
                  correction.correctnessPoints
                    ? 'manage.pointCorrections.summaryAdjustmentCorrectnessAward'
                    : 'manage.pointCorrections.summaryAdjustmentCorrectnessDeduct'
                ),
              ]
            : []),
          ...(typeof correction.bonusPoints === 'boolean'
            ? [
                t(
                  correction.bonusPoints
                    ? 'manage.pointCorrections.summaryAdjustmentBonusAward'
                    : 'manage.pointCorrections.summaryAdjustmentBonusDeduct'
                ),
              ]
            : []),
        ]

        const participantEmail =
          correction.participant?.email ??
          correction.participant?.username ??
          t('manage.pointCorrections.historyScopeParticipantUnknown')
        const participantEmails = correction.participants?.map(
          (p) => p.email ?? p.username
        )

        const instanceName = correction.instance?.elementData?.name?.trim()

        const scopeEntries = [
          correction.type === PointCorrectionType.Single
            ? t('manage.pointCorrections.historyScopeSingle', {
                participant: participantEmail,
              })
            : correction.type === PointCorrectionType.Multiple
              ? t('manage.pointCorrections.historyScopeMultiple', {
                  participants: participantEmails
                    ? participantEmails.join(', ')
                    : t(
                        'manage.pointCorrections.historyScopeParticipantsUnknown'
                      ),
                })
              : correction.type === PointCorrectionType.Participating
                ? t(
                    correction.instance
                      ? 'manage.pointCorrections.historyScopeParticipatingInstance'
                      : 'manage.pointCorrections.historyScopeParticipatingQuiz',
                    { name: instanceName ?? '' }
                  )
                : correction.type === PointCorrectionType.ParticipatingQuiz
                  ? t('manage.pointCorrections.historyScopeParticipatingQuiz')
                  : correction.type === PointCorrectionType.AllCourse
                    ? t('manage.pointCorrections.historyScopeCourse')
                    : null,
        ].filter((entry): entry is string => Boolean(entry))

        const scopeDisplay =
          scopeEntries.length > 0
            ? scopeEntries
            : [t('manage.pointCorrections.historyScopeUnknown')]

        return (
          <li
            key={correction.id}
            className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {t('manage.pointCorrections.summaryLecturerReasonLabel')}
                </div>
                <div className="text-xs text-gray-500">
                  {t('manage.pointCorrections.historyApplied', {
                    appliedAt: dayjs(correction.createdAt).format(
                      'DD.MM.YYYY, HH:mm'
                    ),
                    user:
                      correction.correctedBy?.shortname ??
                      t('shared.generic.deletedUser'),
                  })}
                </div>
              </div>
              <div className="text-sm text-gray-900">
                {lecturerReason || '-'}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoBlock
                title={t('manage.pointCorrections.summaryAdjustmentsLabel')}
              >
                {pointAdjustments.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1">
                    {pointAdjustments.map((adjustment) => (
                      <li key={adjustment}>{adjustment}</li>
                    ))}
                  </ul>
                ) : (
                  <div>{t('manage.pointCorrections.summaryNoAdjustments')}</div>
                )}
              </InfoBlock>

              <InfoBlock title={t('manage.pointCorrections.summaryScopeLabel')}>
                <ul className="list-inside list-disc space-y-1">
                  {scopeDisplay.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </InfoBlock>

              <InfoBlock
                className="sm:col-span-2"
                title={t('manage.pointCorrections.summaryStudentReasonLabel')}
              >
                <div>{studentReason || '-'}</div>
              </InfoBlock>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default PreviousPointCorrectionList
