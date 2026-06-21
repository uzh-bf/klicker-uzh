import { Modal, UserNotification, toast } from '@uzh-bf/design-system'
import { Form, Formik, getIn } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import * as Yup from 'yup'
import { PointCorrectionType } from '../../lib/assessmentResultsTypes'
import { trpc } from '../../lib/trpc'
import PointCorrectionsAdjustmentsStep from './pointCorrections/PointCorrectionsAdjustmentsStep'
import PointCorrectionsAudienceStep from './pointCorrections/PointCorrectionsAudienceStep'
import PointCorrectionsReasonStep from './pointCorrections/PointCorrectionsReasonStep'
import PointCorrectionsScopeStep from './pointCorrections/PointCorrectionsScopeStep'
import PointCorrectionsSummaryStep from './pointCorrections/PointCorrectionsSummaryStep'
import {
  CorrectionScope,
  PointCorrectionsFormValues,
} from './pointCorrections/types'

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
  onClose,
  preselectedLiveQuizId,
  preselectedInstanceId,
  preselectedParticipantId,
}: {
  courseId: string
  onClose: () => void
  preselectedLiveQuizId?: string
  preselectedInstanceId?: string
  preselectedParticipantId?: string
}) {
  const t = useTranslations()
  const [activeStep, setActiveStep] = useState(0)
  const utils = trpc.useUtils()

  const {
    data: endedQuizzesData,
    error: endedQuizzesError,
    isLoading: endedQuizzesLoading,
  } = trpc.activity.endedLiveQuizzesCourse.useQuery(
    { courseId },
    { enabled: Boolean(courseId) }
  )
  const {
    data: courseParticipantsData,
    error: courseParticipantsError,
    isLoading: courseParticipantsLoading,
  } = trpc.activity.assessmentCourseParticipants.useQuery(
    { courseId },
    { enabled: Boolean(courseId) }
  )
  const correctAssessmentPointsInstance =
    trpc.activity.correctAssessmentPointsInstance.useMutation()
  const correctAssessmentPointsLiveQuiz =
    trpc.activity.correctAssessmentPointsLiveQuiz.useMutation()

  const invalidatePointCorrectionData = async ({
    liveQuizId,
    participantId,
  }: {
    liveQuizId: string
    participantId?: string | null
  }) => {
    await Promise.all([
      utils.activity.assessmentResultsCourse.invalidate({ courseId }),
      utils.activity.assessmentResultsLiveQuiz.invalidate({ liveQuizId }),
      utils.activity.previousPointCorrections.invalidate(),
      participantId
        ? utils.activity.liveQuizStudentAssessmentResponses.invalidate({
            liveQuizId,
            participantId,
          })
        : Promise.resolve(),
    ])
  }

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
      participantScope: Yup.mixed<PointCorrectionType>()
        .oneOf([
          PointCorrectionType.Single,
          PointCorrectionType.Multiple,
          PointCorrectionType.Participating,
          PointCorrectionType.AllCourse,
        ])
        .required(),
      participantId: Yup.string()
        .trim()
        .when('participantScope', {
          is: PointCorrectionType.Single,
          then: (schema) =>
            schema.required(
              t('manage.pointCorrections.errorParticipantRequired')
            ),
          otherwise: (schema) => schema.notRequired(),
        }),
      participantIds: Yup.array()
        .of(Yup.string().trim())
        .when('participantScope', {
          is: PointCorrectionType.Multiple,
          then: (schema) =>
            schema.min(
              1,
              t('manage.pointCorrections.errorParticipantsRequired')
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

  const initialValues: PointCorrectionsFormValues = {
    scopeType: preselectedInstanceId ? 'instance' : '',
    quizId: preselectedLiveQuizId ?? '',
    instanceId: preselectedInstanceId ?? '',
    participantScope: preselectedParticipantId
      ? PointCorrectionType.Single
      : '',
    participantId: preselectedParticipantId ?? '',
    participantIds: [],
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

  const stepTitles = [
    t('manage.pointCorrections.scopeTitle'),
    t('manage.pointCorrections.audienceTitle'),
    t('manage.pointCorrections.adjustmentsTitle'),
    t('manage.pointCorrections.reasonTitle'),
    t('manage.pointCorrections.summaryTitle'),
  ]

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchemas[activeStep]}
      onSubmit={async (values, { resetForm, setSubmitting }) => {
        let success = false
        let error: unknown = null
        setSubmitting(true)

        if (values.scopeType === 'instance') {
          if (
            !values.instanceId ||
            Number.isNaN(parseInt(values.instanceId, 10)) ||
            values.participantScope === ''
          ) {
            toast({
              type: 'error',
              message: t('manage.pointCorrections.missingInputsSubmission'),
            })
            setSubmitting(false)
            return
          }

          try {
            const result = await correctAssessmentPointsInstance.mutateAsync({
              instanceId: parseInt(values.instanceId, 10),
              awardBasePoints: values.adjustments.baseAward,
              awardCorrectnessPoints: values.adjustments.correctnessAward,
              awardBonusPoints: values.adjustments.bonusAward,
              deductBasePoints: values.adjustments.baseDeduct,
              deductCorrectnessPoints: values.adjustments.correctnessDeduct,
              deductBonusPoints: values.adjustments.bonusDeduct,
              reason: values.lecturerReason.trim(),
              studentReason: values.useSameReasonForStudents
                ? values.lecturerReason.trim()
                : values.studentReason.trim(),
              scope: values.participantScope,
              participantId: values.participantId,
              participantIds: values.participantIds,
            })
            success = result.correctAssessmentPointsInstance !== null
            if (success) {
              await invalidatePointCorrectionData({
                liveQuizId: values.quizId,
                participantId:
                  preselectedParticipantId || values.participantId || null,
              })
            }
          } catch (mutationError) {
            error = mutationError
          }
        } else {
          if (!values.quizId || values.participantScope === '') {
            toast({
              type: 'error',
              message: t('manage.pointCorrections.missingInputsSubmission'),
            })
            setSubmitting(false)
            return
          }

          try {
            const result = await correctAssessmentPointsLiveQuiz.mutateAsync({
              liveQuizId: values.quizId,
              awardBasePoints: values.adjustments.baseAward,
              awardCorrectnessPoints: values.adjustments.correctnessAward,
              awardBonusPoints: values.adjustments.bonusAward,
              deductBasePoints: values.adjustments.baseDeduct,
              deductCorrectnessPoints: values.adjustments.correctnessDeduct,
              deductBonusPoints: values.adjustments.bonusDeduct,
              reason: values.lecturerReason,
              studentReason: values.useSameReasonForStudents
                ? values.lecturerReason
                : values.studentReason,
              scope: values.participantScope,
              participantId: values.participantId,
              participantIds: values.participantIds,
            })
            success = result.correctAssessmentPointsLiveQuiz !== null
            if (success) {
              await invalidatePointCorrectionData({
                liveQuizId: values.quizId,
                participantId:
                  preselectedParticipantId || values.participantId || null,
              })
            }
          } catch (mutationError) {
            error = mutationError
          }
        }

        if (success) {
          toast({
            type: 'success',
            message: t('manage.pointCorrections.successSubmission'),
          })
          resetForm()
          setSubmitting(false)
          onClose()
        } else {
          toast({
            type: 'error',
            message: t('manage.pointCorrections.errorSubmission'),
          })
          console.error('Error applying point correction:', error)
          setSubmitting(false)
        }
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
        const quizzes = endedQuizzesData?.endedLiveQuizzesCourse
        const participants =
          courseParticipantsData?.assessmentCourseParticipants
        const initialQuizzesLoading = endedQuizzesLoading && !quizzes
        const initialParticipantsLoading =
          courseParticipantsLoading && !participants
        const quizzesUnavailable = Boolean(
          (endedQuizzesError || !endedQuizzesLoading) && !quizzes
        )
        const participantsUnavailable = Boolean(
          (courseParticipantsError || !courseParticipantsLoading) &&
            !participants
        )

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
          <PointCorrectionsScopeStep
            key="scope"
            quizzes={quizzes ?? []}
            disabledLiveQuizSelection={Boolean(preselectedLiveQuizId)}
            disabledInstanceSelection={Boolean(preselectedInstanceId)}
          />,
          <PointCorrectionsAudienceStep
            key="audience"
            participants={participants ?? []}
            fixedParticipant={Boolean(preselectedParticipantId)}
          />,
          <PointCorrectionsAdjustmentsStep key="adjustments" />,
          <PointCorrectionsReasonStep key="reason" />,
          <PointCorrectionsSummaryStep
            key="summary"
            quizzes={quizzes ?? []}
            participants={participants ?? []}
          />,
        ]
        const currentStepLoading =
          (activeStep === 0 && initialQuizzesLoading) ||
          (activeStep === 1 && initialParticipantsLoading) ||
          (activeStep === 4 &&
            (initialQuizzesLoading || initialParticipantsLoading))
        const currentStepUnavailable =
          (activeStep === 0 && quizzesUnavailable) ||
          (activeStep === 1 && participantsUnavailable) ||
          (activeStep === 4 && (quizzesUnavailable || participantsUnavailable))

        const scopeValid = Boolean(
          values.scopeType &&
            values.quizId &&
            (values.scopeType === 'quiz' || values.instanceId)
        )
        const audienceValid = Boolean(
          values.participantScope &&
            (values.participantScope !== PointCorrectionType.Single ||
              values.participantId) &&
            (values.participantScope !== PointCorrectionType.Multiple ||
              (values.participantIds && values.participantIds.length > 0))
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
        const primaryDisabled =
          currentStepLoading ||
          currentStepUnavailable ||
          (isLastStep ? !allValid : !stepStatus[activeStep])

        return (
          <Form>
            <Modal
              open
              escapeDisabled
              loading={currentStepLoading}
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
                  {currentStepUnavailable ? (
                    <UserNotification
                      type="error"
                      message={t('shared.generic.systemError')}
                    />
                  ) : (
                    stepComponents[activeStep]
                  )}
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
