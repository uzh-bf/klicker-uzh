import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import type {
  PointCorrectionsFormValues,
  PointCorrectionsParticipant,
  PointCorrectionsQuiz,
} from './types'

function PointCorrectionsSummaryStep({
  courseName,
  quizzes,
  participants,
}: {
  courseName: string
  quizzes: PointCorrectionsQuiz[]
  participants: PointCorrectionsParticipant[]
}) {
  const { values } = useFormikContext<PointCorrectionsFormValues>()
  const t = useTranslations()

  const selectedQuiz = quizzes.find((quiz) => quiz.id === values.quizId)
  const selectedInstance = selectedQuiz?.instances.find(
    (instance) => instance.id === values.instanceId
  )

  const participantLabels = {
    single: t('manage.pointCorrections.participantScopeSingle'),
    participating: t('manage.pointCorrections.participantScopeParticipating'),
    course: t('manage.pointCorrections.participantScopeCourse'),
  }

  let participantSummary: string
  if (!values.participantScope) {
    participantSummary = t(
      'manage.pointCorrections.summaryParticipantScopeNotSelected'
    )
  } else if (values.participantScope === 'single') {
    const participant = participants.find(
      (item) => item.id === values.participantId
    )
    participantSummary =
      participant?.name ??
      t('manage.pointCorrections.summaryParticipantNotSelected')
  } else {
    participantSummary = participantLabels[values.participantScope]
  }

  const adjustmentSummary: string[] = []
  if (values.adjustments.baseAward) {
    adjustmentSummary.push(
      t('manage.pointCorrections.summaryAdjustmentBaseAward')
    )
  }
  if (values.adjustments.baseDeduct) {
    adjustmentSummary.push(
      t('manage.pointCorrections.summaryAdjustmentBaseDeduct')
    )
  }
  if (values.adjustments.correctnessAward) {
    adjustmentSummary.push(
      t('manage.pointCorrections.summaryAdjustmentCorrectnessAward')
    )
  }
  if (values.adjustments.correctnessDeduct) {
    adjustmentSummary.push(
      t('manage.pointCorrections.summaryAdjustmentCorrectnessDeduct')
    )
  }
  if (values.adjustments.bonusAward) {
    adjustmentSummary.push(
      t('manage.pointCorrections.summaryAdjustmentBonusAward')
    )
  }
  if (values.adjustments.bonusDeduct) {
    adjustmentSummary.push(
      t('manage.pointCorrections.summaryAdjustmentBonusDeduct')
    )
  }

  const adjustmentsDisplay =
    adjustmentSummary.length > 0
      ? adjustmentSummary
      : t('manage.pointCorrections.summaryNoAdjustments')

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gray-700">
        {t('manage.pointCorrections.summaryDescription')}
      </div>

      <div className="flex flex-col gap-4 text-sm text-gray-800">
        <SummaryRow
          label={t('manage.pointCorrections.summaryScopeLabel')}
          value={
            values.scopeType
              ? values.scopeType === 'instance'
                ? t('manage.pointCorrections.scopeOptionInstanceTitle')
                : t('manage.pointCorrections.scopeOptionQuizTitle')
              : t('manage.pointCorrections.scopePlaceholder')
          }
        />
        <SummaryRow
          label={t('manage.pointCorrections.summaryQuizLabel')}
          value={
            selectedQuiz?.name ??
            t('manage.pointCorrections.summaryQuizNotSelected')
          }
        />
        <SummaryRow
          label={t('manage.pointCorrections.summaryInstanceLabel')}
          value={
            values.scopeType === 'instance'
              ? (selectedInstance?.name ??
                t('manage.pointCorrections.summaryInstanceNotSelected'))
              : t('manage.pointCorrections.summaryAllInstances')
          }
        />
        <SummaryRow
          label={t('manage.pointCorrections.summaryParticipantLabel')}
          value={participantSummary}
        />
        <SummaryRow
          label={t('manage.pointCorrections.summaryAdjustmentsLabel')}
          value={adjustmentsDisplay}
        />
        <SummaryRow
          label={t('manage.pointCorrections.summaryLecturerReasonLabel')}
          value={values.lecturerReason.trim()}
        />
        <SummaryRow
          label={t('manage.pointCorrections.summaryStudentReasonLabel')}
          value={values.studentReason.trim()}
        />
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string | string[]
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      {Array.isArray(value) ? (
        <ul className="list-inside list-disc text-sm text-gray-800">
          {value.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-gray-900">{value}</div>
      )}
    </div>
  )
}

export default PointCorrectionsSummaryStep
