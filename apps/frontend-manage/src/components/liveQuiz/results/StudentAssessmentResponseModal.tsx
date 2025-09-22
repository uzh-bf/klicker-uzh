import {
  faCheckCircle,
  faCircleHalfStroke,
  faInfoCircle,
  faXmarkCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstance,
  ResponseCorrectness,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { Modal } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'

export type AssessmentResultInstance = ElementInstance & {
  hasSampleSolution: boolean
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
  correctness?: ResponseCorrectness | null
  availableBasePoints: number
  availableCorrectnessPoints: number
  availableBonusPoints: number
  totalPoints: number
  totalAvailablePoints: number
}

function StudentAssessmentResponseModal({
  instance,
  response,
  participantEmail,
  onClose,
}: {
  instance: AssessmentResultInstance
  response: InstanceStackStudentResponseType
  participantEmail: string
  onClose: () => void
}) {
  const t = useTranslations()
  const formatter = useFormatter()

  const correctnessLabelMap: Record<
    ResponseCorrectness | 'UNSET',
    React.ReactNode
  > = {
    [ResponseCorrectness.Correct]: (
      <div className="text-uzh-darkgreen-100">
        <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
        {t('manage.assessment.liveQuizCorrect')}
      </div>
    ),
    [ResponseCorrectness.Partial]: (
      <div className="text-uzh-red-100">
        <FontAwesomeIcon icon={faCircleHalfStroke} className="mr-2" />
        {t('manage.assessment.liveQuizPartiallyCorrect')}
      </div>
    ),
    [ResponseCorrectness.Wrong]: (
      <div className="text-red-600">
        <FontAwesomeIcon icon={faXmarkCircle} className="mr-2" />
        {t('manage.assessment.liveQuizIncorrect')}
      </div>
    ),
    UNSET: <div>{t('manage.assessment.liveQuizNotAnswered')}</div>,
  }

  const formatPoints = (value: number) =>
    formatter.number(value, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    })

  return (
    <Modal
      open={Boolean(instance)}
      onClose={onClose}
      title={instance?.elementData.name ?? ''}
      className={{ content: 'max-w-4xl' }}
      primaryLabel={t('shared.generic.close')}
      onPrimaryAction={onClose}
    >
      {instance ? (
        <div className="flex flex-col gap-4 text-sm">
          <div className="border-muted-foreground/20 bg-muted/30 rounded-lg border p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-base leading-tight">
                  {t('manage.assessment.responseBy', {
                    email: participantEmail,
                  })}
                </span>
                {instance.hasSampleSolution ? (
                  correctnessLabelMap[
                    (!!response
                      ? (instance.correctness ?? 'UNSET')
                      : 'UNSET') as ResponseCorrectness | 'UNSET'
                  ]
                ) : (
                  <div className="text-primary-100 flex flex-row items-center gap-1.5">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    <span>{t('manage.assessment.noSampleSolution')}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  key: 'base',
                  label: t('manage.general.basePointsDescription'),
                  achieved: instance.basePoints,
                  available: instance.availableBasePoints,
                  emphasize: false,
                },
                {
                  key: 'correctness',
                  label: t('manage.general.correctnessPointsDescription'),
                  achieved: instance.correctnessPoints,
                  available: instance.availableCorrectnessPoints,
                  emphasize: false,
                },
                {
                  key: 'bonus',
                  label: t('manage.general.bonusPointsDescription'),
                  achieved: instance.bonusPoints,
                  available: instance.availableBonusPoints,
                  emphasize: false,
                },
                {
                  key: 'total',
                  label: t('shared.generic.total'),
                  achieved: instance.totalPoints,
                  available: instance.totalAvailablePoints,
                  emphasize: true,
                },
              ].map((section) => (
                <div
                  key={section.key}
                  className="bg-background rounded-md px-3 py-2 shadow-sm"
                >
                  <div className="text-muted-foreground text-[0.65rem] tracking-wide">
                    {section.label}
                  </div>
                  <div
                    className={twMerge(
                      'flex items-baseline gap-1 text-lg leading-tight',
                      section.emphasize && 'font-semibold'
                    )}
                  >
                    <span>{formatPoints(section.achieved)}</span>
                    <span className="text-muted-foreground text-[0.65rem] font-normal">
                      {`/ ${formatPoints(section.available)}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <StudentElement
            preview
            element={instance}
            elementIx={0}
            singleStudentResponse={response}
            setSingleStudentResponse={
              (() => undefined) as Dispatch<
                SetStateAction<InstanceStackStudentResponseType>
              >
            }
            hideReadButton
            disabledInput
          />
        </div>
      ) : null}
    </Modal>
  )
}

export default StudentAssessmentResponseModal
