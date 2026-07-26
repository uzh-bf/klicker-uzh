import { useMutation } from '@apollo/client'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import {
  CreateLiveQuizDocument,
  EditLiveQuizDocument,
  Element,
  ElementType,
  GetSingleLiveQuizQuery,
  GetUserRunningLiveQuizzesDocument,
  LiveQuiz,
  PublicationStatus,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
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
  onSubmit?: (newValues: LiveQuizFormValues) => Promise<void>
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onNextStep?: (newValues: LiveQuizFormValues) => void
  onPrevStep?: (newValues: LiveQuizFormValues) => void
  closeWizard: () => void
}

interface LiveQuizWizardProps {
  title: string
  courses: ElementSelectCourse[]
  initialValues?: Omit<
    Pick<
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
    >,
    'blocks'
  > & {
    blocks?: NonNullable<GetSingleLiveQuizQuery['liveQuiz']>['blocks']
    course?: { id: string } | null
  }
  selection: Record<number, Element>
  resetSelection: () => void
  closeWizard: () => void
  editMode: boolean
  duplicationMode: boolean
  escapeRoomHints?: Array<{ instanceId: number; hint: string }>
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
  escapeRoomHints = [],
}: LiveQuizWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
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
      yup
        .object()
        .shape({
          elements: yup
            .array()
            .min(1, t('manage.activityWizard.minOneElementPerBlock'))
            .of(
              yup.object().shape({
                id: yup.number(),
                title: yup.string(),
                type: yup
                  .string()
                  .oneOf(
                    [...acceptedTypes, ElementType.QrScan],
                    t('manage.activityWizard.liveQuizTypes')
                  ),
                hasSampleSolution: yup.boolean().nullable(),
              })
            )
            .when('isEscapeRoom', {
              is: true,
              then: (schema) =>
                schema.test(
                  'escape-room-types',
                  t('manage.activityWizard.liveQuizTypes'),
                  (elements) =>
                    !!elements?.length &&
                    elements.every((element) =>
                      element.type
                        ? [
                            ElementType.Sc,
                            ElementType.Mc,
                            ElementType.Kprim,
                            ElementType.Numerical,
                            ElementType.FreeText,
                            ElementType.QrScan,
                          ].includes(element.type)
                        : false
                    )
                ),
              otherwise: (schema) =>
                schema.test(
                  'no-qr-scan-outside-escape-room',
                  t('manage.activityWizard.escapeRoomNoQrOutside'),
                  (elements) =>
                    !elements?.some(
                      (element) => element.type === ElementType.QrScan
                    )
                ),
            }),
          timeLimit: yup
            .number()
            .min(1, t('manage.activityWizard.liveQuizTimeRestriction')),
          escapeRoomTimeLimit: yup.number().when('isEscapeRoom', {
            is: true,
            then: (schema) => schema.required().min(1),
          }),
          escapeRoomHintPenalty: yup.number().when('isEscapeRoom', {
            is: true,
            then: (schema) => schema.required().min(0),
          }),
          isEscapeRoom: yup.boolean(),
        })
        .test(
          'escape-room-assessment',
          t('manage.activityWizard.escapeRoomAssessmentIncompatible'),
          (block) => !formData.isAssessmentEnabled || !block.isEscapeRoom
        )
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
          isEscapeRoom: !!block.escapeRoomConfig,
          escapeRoomTimeLimit: block.escapeRoomConfig?.timeLimit
            ? Math.round(block.escapeRoomConfig.timeLimit / 60)
            : 5,
          escapeRoomHintPenalty: block.escapeRoomConfig?.hintPenalty ?? 0,
          escapeRoomIntroText: block.escapeRoomConfig?.introText ?? '',
          elements: block.elements!.map((instance) => {
            const [elementId, _] = instance.elementData.id.split('-v')

            return {
              id: parseInt(elementId, 10),
              title: instance.elementData.name,
              type: instance.elementData.type,
              hasSampleSolution:
                'options' in instance.elementData
                  ? (instance.elementData.options.hasSampleSolution ?? false)
                  : true,
              existingInstanceId: instance.id,
              duplicateInstance: duplicationMode,
              escapeRoomHint:
                escapeRoomHints.find((hint) => hint.instanceId === instance.id)
                  ?.hint ?? null,
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

  const [editLiveQuiz, { data: editingData }] =
    useMutation(EditLiveQuizDocument)
  const [createLiveQuiz, { data: creationData }] = useMutation(
    CreateLiveQuizDocument
  )
  const [startLiveQuiz] = useMutation(StartLiveQuizDocument)

  const handleSubmit = useCallback(
    (values: LiveQuizFormValues) => {
      return submitLiveQuizForm({
        id: initialValues?.id,
        previousCourseId: initialValues?.course?.id,
        editMode,
        values,
        createLiveQuiz,
        editLiveQuiz,
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
    [createLiveQuiz, editMode, editLiveQuiz, initialValues?.id]
  )

  const isActivityReviewer =
    creationData?.createLiveQuiz?.isActivityReviewer ??
    editingData?.editLiveQuiz?.isActivityReviewer
  const selectedCourseId =
    creationData?.createLiveQuiz?.courseId ??
    editingData?.editLiveQuiz?.courseId

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
          {creationData?.createLiveQuiz?.id || editingData?.editLiveQuiz?.id ? (
            <Button
              data={{ cy: 'quick-start' }}
              onClick={async () => {
                await startLiveQuiz({
                  variables: {
                    id:
                      creationData?.createLiveQuiz?.id ??
                      editingData!.editLiveQuiz!.id,
                  },
                  update(cache, { data: res }) {
                    // return early if the mutation failed
                    if (!res?.startLiveQuiz) return

                    cache.updateQuery(
                      { query: GetUserRunningLiveQuizzesDocument },
                      (data) => {
                        // if no data is present, return early
                        if (!data?.userRunningLiveQuizzes) return data

                        // add the new live quiz to the existing list
                        return {
                          userRunningLiveQuizzes: [
                            ...data.userRunningLiveQuizzes,
                            {
                              id: res.startLiveQuiz!.id,
                              name: res.startLiveQuiz!.name,
                            },
                          ],
                        }
                      }
                    )
                  },
                  optimisticResponse: {
                    startLiveQuiz: {
                      __typename: 'LiveQuizMeta',
                      id:
                        creationData?.createLiveQuiz?.id ??
                        editingData!.editLiveQuiz!.id,
                      name:
                        creationData?.createLiveQuiz?.name ??
                        editingData!.editLiveQuiz!.name,
                      status: PublicationStatus.Published,
                    },
                  },
                })
                router.push(
                  `/quizzes/${creationData?.createLiveQuiz?.id ?? editingData?.editLiveQuiz?.id}/cockpit`
                )
              }}
            >
              <Button.Icon icon={faPlay} />
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
