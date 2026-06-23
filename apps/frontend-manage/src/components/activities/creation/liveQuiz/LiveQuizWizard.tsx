import { faPlay } from '@fortawesome/free-solid-svg-icons'
import {
  LQ_DEFAULT_CORRECT_POINTS,
  LQ_DEFAULT_POINTS,
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import useCoursesGamificationSplit from '@lib/hooks/useCoursesGamificationSplit'
import { Button, toast } from '@uzh-bf/design-system'
import { FormikProps } from 'formik'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react'
import * as yup from 'yup'
import {
  Element,
  ElementType,
  LiveQuiz,
} from '../../../../lib/constants/activityEnums'
import { trpc } from '../../../../lib/trpc'
import { ElementSelectCourse } from '../../ActivityCreation'
import CompletionStep from '../CompletionStep'
import WizardLayout, { LiveQuizFormValues } from '../WizardLayout'
import LiveQuizDescriptionStep from './LiveQuizDescriptionStep'
import LiveQuizInformationStep from './LiveQuizInformationStep'
import LiveQuizQuestionsStep from './LiveQuizQuestionsStep'
import LiveQuizSettingsStep from './LiveQuizSettingsStep'
import submitLiveQuizForm from './submitLiveQuizForm'

// flashcards are not accepted in live quizzes -> only makes sense in combination with spaced repetition / async learning
const acceptedTypes = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
  ElementType.Content,
  ElementType.Selection,
  ElementType.CaseStudy,
]

export interface LiveQuizWizardStepProps {
  editMode: boolean
  duplicationMode?: boolean
  formRef: any
  formData: LiveQuizFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  assessmentCourses?: ElementSelectCourse[]
  onSubmit?: (newValues: LiveQuizFormValues) => void
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onNextStep?: (newValues: LiveQuizFormValues) => void
  onPrevStep?: (newValues: LiveQuizFormValues) => void
  closeWizard: () => void
}

interface LiveQuizWizardProps {
  title: string
  courses: ElementSelectCourse[]
  initialValues?: Pick<
    LiveQuiz,
    | 'id'
    | 'name'
    | 'displayName'
    | 'description'
    | 'pointsMultiplier'
    | 'defaultPoints'
    | 'defaultCorrectPoints'
    | 'maxBonusPoints'
    | 'timeToZeroBonus'
    | 'isConfusionFeedbackEnabled'
    | 'isGamificationEnabled'
    | 'isAssessmentEnabled'
    | 'pinCode'
    | 'isLiveQAEnabled'
    | 'isModerationEnabled'
    | 'blocks'
  > & { course?: { id: string } | null }
  selection: Record<number, Element>
  resetSelection: () => void
  closeWizard: () => void
  editMode: boolean
  duplicationMode: boolean
}

function LiveQuizWizard({
  title,
  courses,
  initialValues,
  selection,
  resetSelection,
  closeWizard,
  editMode,
  duplicationMode,
}: LiveQuizWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [quickStartRouting, setQuickStartRouting] = useState(false)
  const [stepValidity, setStepValidity] = useState<boolean[]>(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<LiveQuizFormValues>>(null)

  const { gamifiedCourses, nonGamifiedCourses, assessmentCourses } =
    useCoursesGamificationSplit({
      courseSelection: courses,
    })

  const nameValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.activityWizard.activityName')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.activityWizard.activityDisplayName')),
    description: yup.string(),
  })

  const settingsValidationSchema = yup.object().shape({
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.activityWizard.validMultiplicator')),
    courseId: yup.string(),
    isGamificationEnabled: yup
      .boolean()
      .required(t('manage.activityWizard.liveQuizGamified')),
    defaultPoints: yup
      .number()
      .required(t('manage.activityWizard.liveQuizDefaultPointsReq'))
      .min(0, t('manage.activityWizard.liveQuizDefaultPointsMin')),
    defaultCorrectPoints: yup
      .number()
      .required(t('manage.activityWizard.liveQuizDefaultCorrectPointsReq'))
      .min(0, t('manage.activityWizard.liveQuizDefaultCorrectPointsMin')),
    maxBonusPoints: yup
      .number()
      .required(t('manage.activityWizard.liveQuizMaxBonusPointsReq'))
      .min(0, t('manage.activityWizard.liveQuizMaxBonusPointsMin')),
    timeToZeroBonus: yup
      .number()
      .required(t('manage.activityWizard.liveQuizTimeToZeroBonusReq'))
      .min(1, t('manage.activityWizard.liveQuizTimeToZeroBonusMin')),
  })

  const questionsValidationSchema = yup.object().shape({
    blocks: yup.array().of(
      yup.object().shape({
        elements: yup
          .array()
          .min(1, t('manage.activityWizard.minOneElementPerBlock'))
          .of(
            yup.object().shape({
              id: yup.number(),
              title: yup.string(),
              type: yup
                .string()
                .oneOf(acceptedTypes, t('manage.activityWizard.liveQuizTypes')),
              hasSampleSolution: yup.boolean().nullable(),
            })
          ),
        timeLimit: yup
          .number()
          .min(1, t('manage.activityWizard.liveQuizTimeRestriction')),
      })
    ),
  })

  const formDefaultValues = {
    name: '',
    displayName: '',
    description: '',
    blocks: [{ timeLimit: undefined, elements: [] }],
    courseId: 'no-course-selected',
    multiplier: '1',
    defaultPoints: LQ_DEFAULT_POINTS,
    defaultCorrectPoints: LQ_DEFAULT_CORRECT_POINTS,
    maxBonusPoints: LQ_MAX_BONUS_POINTS,
    timeToZeroBonus: LQ_TIME_TO_ZERO_BONUS,
    isGamificationEnabled: false,
    isAssessmentEnabled: false,
    isPinProtected: false,
    isConfusionFeedbackEnabled: true,
    isLiveQAEnabled: false,
    isModerationEnabled: true,
  }

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.activityWizard.liveQuizInformation'),
      completed: stepValidity[0],
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.activityWizard.liveQuizDescription'),
      tooltipDisabled: t('manage.activityWizard.liveQuizDescription'),
      completed: stepValidity[1],
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.activityWizard.liveQuizSettings'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[2],
    },
    {
      title: t('manage.activityWizard.liveQuizBlocks'),
      tooltip: t('manage.activityWizard.liveQuizDragDrop'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[3],
    },
  ]

  const [formData, setFormData] = useState<LiveQuizFormValues>({
    name: initialValues?.name || formDefaultValues.name,
    displayName: initialValues?.displayName || formDefaultValues.displayName,
    description: initialValues?.description || formDefaultValues.description,
    blocks: initialValues?.blocks
      ? initialValues.blocks.map((block) => ({
          timeLimit: block.timeLimit ?? undefined,
          elements: block.elements!.map((instance) => {
            const [elementId, _] = instance.elementData.id.split('-v')

            return {
              id: parseInt(elementId),
              title: instance.elementData.name,
              type: instance.elementData.type,
              hasSampleSolution:
                'options' in instance.elementData &&
                instance.elementData.options != null
                  ? (instance.elementData.options.hasSampleSolution ?? false)
                  : true,
              existingInstanceId: instance.id,
              duplicateInstance: duplicationMode,
            }
          }),
        }))
      : formDefaultValues.blocks,
    courseId: initialValues?.course?.id || formDefaultValues.courseId,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
    defaultPoints:
      initialValues?.defaultPoints ?? formDefaultValues.defaultPoints,
    defaultCorrectPoints:
      initialValues?.defaultCorrectPoints ??
      formDefaultValues.defaultCorrectPoints,
    maxBonusPoints:
      initialValues?.maxBonusPoints ?? formDefaultValues.maxBonusPoints,
    timeToZeroBonus:
      initialValues?.timeToZeroBonus ?? formDefaultValues.timeToZeroBonus,
    isGamificationEnabled:
      initialValues?.isGamificationEnabled ??
      formDefaultValues.isGamificationEnabled,
    isAssessmentEnabled:
      initialValues?.isAssessmentEnabled ??
      formDefaultValues.isAssessmentEnabled,
    isPinProtected: initialValues?.pinCode ? true : false,
    isConfusionFeedbackEnabled:
      initialValues?.isConfusionFeedbackEnabled ??
      formDefaultValues.isConfusionFeedbackEnabled,
    isLiveQAEnabled:
      initialValues?.isLiveQAEnabled ?? formDefaultValues.isLiveQAEnabled,
    isModerationEnabled:
      initialValues?.isModerationEnabled ??
      formDefaultValues.isModerationEnabled,
  })

  const createLiveQuiz = trpc.activity.createLiveQuiz.useMutation()
  const editLiveQuiz = trpc.activity.editLiveQuiz.useMutation()
  const utils = trpc.useUtils()
  const startLiveQuiz = trpc.liveQuiz.start.useMutation({
    onSuccess: async (result) => {
      if (!result.liveQuiz) return
      await utils.liveQuiz.running.invalidate()
    },
  })
  const quickStarting = startLiveQuiz.isLoading || quickStartRouting
  const invalidateCourseDetail = useCallback(
    async (courseId: string) => {
      await utils.course.detail.invalidate({ courseId })
    },
    [utils]
  )
  const invalidateActivities = useCallback(async () => {
    await Promise.all([
      utils.activity.userActivities.invalidate(),
      ...(initialValues?.id
        ? [
            utils.activity.authoringLiveQuiz.invalidate({
              activityId: initialValues.id,
            }),
          ]
        : []),
    ])
  }, [initialValues?.id, utils])

  const handleSubmit = useCallback(
    async (values: LiveQuizFormValues) => {
      await submitLiveQuizForm({
        id: initialValues?.id,
        previousCourseId: initialValues?.course?.id,
        editMode,
        values,
        createLiveQuiz: createLiveQuiz.mutateAsync,
        editLiveQuiz: editLiveQuiz.mutateAsync,
        invalidateCourseDetail,
        invalidateActivities,
        setIsWizardCompleted,
        onError: () =>
          toast({
            type: 'error',
            message: (
              <div>
                <div>
                  {editMode
                    ? t('manage.activityWizard.liveQuizEditingFailed')
                    : t('manage.activityWizard.liveQuizCreationFailed')}
                </div>
                <div>{t('manage.activityWizard.considerFormErrors')}</div>
              </div>
            ),
            options: { duration: 6000 },
          }),
      })
    },
    [
      createLiveQuiz.mutateAsync,
      editMode,
      editLiveQuiz.mutateAsync,
      initialValues?.course?.id,
      initialValues?.id,
      invalidateActivities,
      invalidateCourseDetail,
    ]
  )

  const isActivityReviewer =
    createLiveQuiz.data?.createLiveQuiz?.isActivityReviewer ??
    editLiveQuiz.data?.editLiveQuiz?.isActivityReviewer
  const selectedCourseId =
    createLiveQuiz.data?.createLiveQuiz?.courseId ??
    editLiveQuiz.data?.editLiveQuiz?.courseId
  const liveQuizId =
    createLiveQuiz.data?.createLiveQuiz?.id ??
    editLiveQuiz.data?.editLiveQuiz?.id

  return (
    <WizardLayout
      title={title}
      editMode={editMode}
      activeStep={activeStep}
      setActiveStep={setActiveStep}
      disabledFrom={findIndex(stepValidity, (valid) => !valid) + 1}
      workflowItems={workflowItems}
      isCompleted={isWizardCompleted}
      completionStep={
        <CompletionStep
          completionSuccessMessage={(elementName) => (
            <div>
              {editMode
                ? t.rich('manage.activityWizard.liveQuizUpdated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })
                : t.rich('manage.activityWizard.liveQuizCreated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })}
            </div>
          )}
          name={formData.name}
          editMode={editMode}
          viewElementHref={
            isActivityReviewer && selectedCourseId
              ? `/courses/${selectedCourseId}?tab=liveQuizzes`
              : '/activities'
          }
          onRestartForm={() => {
            setIsWizardCompleted(false)
            closeWizard()
          }}
          resetForm={() => setFormData(formDefaultValues)}
          setStepNumber={setActiveStep}
          onCloseWizard={closeWizard}
        >
          {liveQuizId ? (
            <Button
              data={{ cy: 'quick-start' }}
              onClick={async () => {
                if (quickStarting) return

                setQuickStartRouting(true)

                try {
                  const result = await startLiveQuiz.mutateAsync({
                    id: liveQuizId,
                  })
                  if (!result.liveQuiz) {
                    toast({
                      type: 'error',
                      message: t('shared.generic.systemError'),
                      options: { duration: 5000 },
                    })
                    return
                  }

                  const routed = await router.push(
                    `/quizzes/${liveQuizId}/cockpit`
                  )
                  if (!routed)
                    throw new Error('Live quiz quick-start navigation failed')
                } catch (error) {
                  console.error(error)
                  toast({
                    type: 'error',
                    message: t('shared.generic.systemError'),
                    options: { duration: 5000 },
                  })
                } finally {
                  setQuickStartRouting(false)
                }
              }}
              disabled={quickStarting}
              loading={quickStarting}
            >
              <Button.Icon icon={faPlay} loading={quickStarting} />
              <Button.Label>
                {t('manage.activityWizard.liveQuizStartNow')}
              </Button.Label>
            </Button>
          ) : null}
        </CompletionStep>
      }
      steps={[
        <LiveQuizInformationStep
          key="live-quiz-information-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={nameValidationSchema}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<LiveQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          closeWizard={closeWizard}
        />,
        <LiveQuizDescriptionStep
          key="live-quiz-description-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={descriptionValidationSchema}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<LiveQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<LiveQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizard}
        />,
        <LiveQuizSettingsStep
          key="live-quiz-settings-step"
          editMode={editMode}
          duplicationMode={duplicationMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={settingsValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
          assessmentCourses={assessmentCourses}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<LiveQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<LiveQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizard}
        />,
        <LiveQuizQuestionsStep
          key="live-quiz-questions-step"
          editMode={editMode}
          selection={selection}
          resetSelection={resetSelection}
          formRef={formRef}
          formData={formData}
          acceptedTypes={acceptedTypes}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={questionsValidationSchema}
          setStepValidity={setStepValidity}
          onSubmit={(newValues: LiveQuizFormValues) =>
            handleSubmit({ ...formData, ...newValues })
          }
          onPrevStep={(newValues: Partial<LiveQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizard}
        />,
      ]}
      saveFormData={() => {
        setFormData((prev) => ({ ...prev, ...formRef.current?.values }))
      }}
    />
  )
}

export default LiveQuizWizard
