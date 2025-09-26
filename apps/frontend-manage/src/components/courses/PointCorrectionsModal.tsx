import { Modal } from '@uzh-bf/design-system'
import { Form, Formik, getIn } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import * as Yup from 'yup'
import PointCorrectionsAdjustmentsStep from './pointCorrections/PointCorrectionsAdjustmentsStep'
import PointCorrectionsAudienceStep from './pointCorrections/PointCorrectionsAudienceStep'
import PointCorrectionsReasonStep from './pointCorrections/PointCorrectionsReasonStep'
import PointCorrectionsScopeStep from './pointCorrections/PointCorrectionsScopeStep'
import PointCorrectionsSummaryStep from './pointCorrections/PointCorrectionsSummaryStep'
import {
  CorrectionScope,
  ParticipantScope,
  PointCorrectionsFormValues,
  PointCorrectionsParticipant,
  PointCorrectionsQuiz,
} from './pointCorrections/types'

const initialValues: PointCorrectionsFormValues = {
  scopeType: '',
  quizId: '',
  instanceId: '',
  participantScope: '',
  participantId: '',
  lecturerReason: '',
  studentReason: '',
  useSameReasonForStudents: false,
  adjustments: {
    baseAward: false,
    baseDeduct: false,
    correctnessAward: false,
    correctnessDeduct: false,
    bonusAward: false,
    bonusDeduct: false,
  },
}

const stepFieldPaths: (
  | keyof PointCorrectionsFormValues
  | `adjustments.${keyof PointCorrectionsFormValues['adjustments']}`
)[][] = [
  ['scopeType', 'quizId', 'instanceId'],
  ['participantScope', 'participantId'],
  [
    'adjustments.baseAward',
    'adjustments.baseDeduct',
    'adjustments.correctnessAward',
    'adjustments.correctnessDeduct',
    'adjustments.bonusAward',
    'adjustments.bonusDeduct',
  ],
  ['lecturerReason', 'studentReason', 'useSameReasonForStudents'],
  [
    'scopeType',
    'quizId',
    'instanceId',
    'participantScope',
    'participantId',
    'lecturerReason',
    'studentReason',
    'useSameReasonForStudents',
  ],
]

function PointCorrectionsModal({
  courseId,
  courseName,
  onClose,
}: {
  courseId: string
  courseName: string
  onClose: () => void
}) {
  const t = useTranslations()
  const [activeStep, setActiveStep] = useState(0)

  const validationSchemas = useMemo(() => {
    const adjustmentSchema = Yup.object({
      adjustments: Yup.object({
        baseAward: Yup.boolean(),
        baseDeduct: Yup.boolean(),
        correctnessAward: Yup.boolean(),
        correctnessDeduct: Yup.boolean(),
        bonusAward: Yup.boolean(),
        bonusDeduct: Yup.boolean(),
      }).test(
        'point-corrections-at-least-one',
        t('manage.pointCorrections.errorNoAdjustment'),
        (value) => {
          if (!value) {
            return false
          }

          return (
            value.baseAward ||
            value.baseDeduct ||
            value.correctnessAward ||
            value.correctnessDeduct ||
            value.bonusAward ||
            value.bonusDeduct
          )
        }
      ),
    })

    const scopeSchema = Yup.object({
      scopeType: Yup.mixed<CorrectionScope>()
        .oneOf(['instance', 'quiz'])
        .required(),
      quizId: Yup.string()
        .trim()
        .required(t('manage.pointCorrections.errorQuizRequired')),
      instanceId: Yup.string()
        .trim()
        .when('scopeType', {
          is: 'instance',
          then: (schema) =>
            schema.required(t('manage.pointCorrections.errorInstanceRequired')),
          otherwise: (schema) => schema.notRequired(),
        }),
    })

    const participantSchema = Yup.object({
      participantScope: Yup.mixed<ParticipantScope>()
        .oneOf(['single', 'participating', 'course'])
        .required(),
      participantId: Yup.string()
        .trim()
        .when('participantScope', {
          is: 'single',
          then: (schema) =>
            schema.required(
              t('manage.pointCorrections.errorParticipantRequired')
            ),
          otherwise: (schema) => schema.notRequired(),
        }),
    })

    const reasonSchema = Yup.object({
      lecturerReason: Yup.string()
        .trim()
        .required(t('manage.pointCorrections.errorLecturerReasonRequired')),
      studentReason: Yup.string()
        .trim()
        .required(t('manage.pointCorrections.errorStudentReasonRequired')),
    })

    return [
      scopeSchema,
      participantSchema,
      adjustmentSchema,
      reasonSchema,
      scopeSchema
        .concat(participantSchema)
        .concat(adjustmentSchema)
        .concat(reasonSchema),
    ]
  }, [t])

  const stepTitles = [
    t('manage.pointCorrections.scopeTitle'),
    t('manage.pointCorrections.audienceTitle'),
    t('manage.pointCorrections.adjustmentsTitle'),
    t('manage.pointCorrections.reasonTitle'),
    t('manage.pointCorrections.summaryTitle'),
  ]

  const demoQuizzes: PointCorrectionsQuiz[] = [
    {
      id: 'quiz-1',
      name: 'Sample Midterm Quiz',
      instances: [
        { id: 'instance-1', name: 'Instance A - 12 Jan 2024' },
        { id: 'instance-2', name: 'Instance B - 19 Jan 2024' },
      ],
      previousCorrections: [
        {
          id: 'correction-1',
          description: 'Adjusted bonus points for late submission handling.',
          appliedAt: '2024-04-12 10:45',
        },
        {
          id: 'correction-2',
          description:
            'Awarded base points for technical issue during quiz session.',
          appliedAt: '2024-02-05 09:10',
        },
      ],
    },
    {
      id: 'quiz-2',
      name: 'Weekly Knowledge Check',
      instances: [
        { id: 'instance-3', name: 'Week 3 - 05 Mar 2024' },
        { id: 'instance-4', name: 'Week 4 - 12 Mar 2024' },
      ],
      previousCorrections: [],
    },
  ]

  const demoParticipants: PointCorrectionsParticipant[] = [
    { id: 'participant-1', name: 'Alex Mueller' },
    { id: 'participant-2', name: 'Jamie Lee' },
    { id: 'participant-3', name: 'Morgan Chen' },
  ]

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchemas[activeStep]}
      onSubmit={async (values) => {
        // TODO: replace with point correction mutation
      }}
    >
      {({
        resetForm,
        validateForm,
        setFieldTouched,
        isSubmitting,
        submitForm,
        values,
      }) => {
        const handleClose = () => {
          resetForm()
          setActiveStep(0)
          onClose()
        }

        const goToNextStep = async () => {
          const errors = await validateForm()
          const relevantFields = stepFieldPaths[activeStep]

          const hasErrors = relevantFields.some((field) =>
            Boolean(getIn(errors, field))
          )

          if (hasErrors) {
            relevantFields.forEach((field) => {
              setFieldTouched(field, true, false)
            })
            return
          }

          setActiveStep((prev) => Math.min(prev + 1, stepFieldPaths.length - 1))
        }

        const stepComponents = [
          <PointCorrectionsScopeStep key="scope" quizzes={demoQuizzes} />,
          <PointCorrectionsAudienceStep
            key="audience"
            participants={demoParticipants}
          />,
          <PointCorrectionsAdjustmentsStep key="adjustments" />,
          <PointCorrectionsReasonStep key="reason" />,
          <PointCorrectionsSummaryStep
            key="summary"
            courseName={courseName}
            quizzes={demoQuizzes}
            participants={demoParticipants}
          />,
        ]

        const scopeValid = Boolean(
          values.scopeType &&
            values.quizId &&
            (values.scopeType === 'quiz' || values.instanceId)
        )
        const audienceValid = Boolean(
          values.participantScope &&
            (values.participantScope !== 'single' || values.participantId)
        )
        const adjustmentsValid = Object.values(values.adjustments).some(Boolean)
        const reasonValid = Boolean(
          values.lecturerReason.trim() && values.studentReason.trim()
        )

        const allValid =
          scopeValid && audienceValid && adjustmentsValid && reasonValid
        const stepStatus = [
          scopeValid,
          audienceValid,
          adjustmentsValid,
          reasonValid,
          allValid,
        ]
        const isLastStep = activeStep === stepComponents.length - 1
        const primaryDisabled = isLastStep ? !allValid : !stepStatus[activeStep]

        return (
          <Form>
            <Modal
              open
              escapeDisabled
              title={t('manage.course.pointCorrections')}
              onClose={handleClose}
              secondaryLabel={
                activeStep === 0
                  ? t('shared.generic.cancel')
                  : t('shared.generic.back')
              }
              onSecondaryAction={(event) => {
                event?.stopPropagation()
                activeStep === 0
                  ? handleClose()
                  : setActiveStep((prev) => Math.max(prev - 1, 0))
              }}
              primaryLabel={
                isLastStep
                  ? t('manage.pointCorrections.actionApply')
                  : t('shared.generic.next')
              }
              primaryDisabled={primaryDisabled}
              primaryLoading={isSubmitting}
              onPrimaryAction={async (event) => {
                event?.stopPropagation()
                isLastStep ? await submitForm() : await goToNextStep()
              }}
              className={{
                content: 'max-w-3xl',
                title: 'text-xl',
                footer: 'justify-between',
              }}
              dataCloseButton={{ cy: 'close-point-corrections-modal' }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {t('manage.pointCorrections.stepIndicator', {
                      current: activeStep + 1,
                      total: stepComponents.length,
                    })}
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {stepTitles[activeStep]}
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                  {stepComponents[activeStep]}
                </div>
              </div>
            </Modal>
          </Form>
        )
      }}
    </Formik>
  )
}

export default PointCorrectionsModal
