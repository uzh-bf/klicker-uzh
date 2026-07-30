import { useMutation, useQuery } from '@apollo/client'
import {
  AdaptivePracticeQuizPreset,
  AdaptivePracticeQuizPreviewDocument,
  AdaptivePracticeQuizPreviewQuery,
  CreatePracticeQuizDocument,
  EditPracticeQuizDocument,
  Element,
  ElementOrderType,
  ElementType,
  PracticeQuiz,
  PracticeQuizMode,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import useCoursesGamificationSplit from '@lib/hooks/useCoursesGamificationSplit'
import { Button, UserNotification, toast } from '@uzh-bf/design-system'
import { FormikProps } from 'formik'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import * as yup from 'yup'
import { ElementSelectCourse } from '../../ActivityCreation'
import CompletionStep from '../CompletionStep'
import StackCreationStep from '../StackCreationStep'
import WizardLayout, { PracticeQuizFormValues } from '../WizardLayout'
import AdaptivePracticeQuizSetupStep from './AdaptivePracticeQuizSetupStep'
import PracticeQuizDescriptionStep from './PracticeQuizDescriptionStep'
import PracticeQuizInformationStep from './PracticeQuizInformationStep'
import PracticeQuizSettingsStep from './PracticeQuizSettingsStep'
import {
  ADAPTIVE_MAX_CLASSIFICATION_Z,
  ADAPTIVE_MAX_DISCRIMINATION,
  ADAPTIVE_MAX_QUESTION_CAP,
  createAdaptivePracticeQuizDefaultConfig,
  createEmptyPracticeQuizStack,
  mapAdaptivePracticeQuizPreviewToForm,
} from './adaptivePracticeQuizForm'
import { asAdaptiveTranslator } from './adaptiveReadinessIssue'
import submitPracticeQuizForm from './submitPracticeQuizForm'

export interface PracticeQuizWizardStepProps {
  editMode: boolean
  formRef: any
  formData: PracticeQuizFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  assessmentCourses?: ElementSelectCourse[]
  adaptiveCourses?: ElementSelectCourse[]
  adaptiveInitialPreview?: NonNullable<
    AdaptivePracticeQuizPreviewQuery['adaptivePracticeQuizPreview']
  >
  onSubmit?: (newValues: PracticeQuizFormValues) => void
  onModeChange?: (newValues: PracticeQuizFormValues) => void
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onPrevStep?: (newValues: PracticeQuizFormValues) => void
  onNextStep?: (newValues: PracticeQuizFormValues) => void
  closeWizard: () => void
}

const acceptedTypes = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
  ElementType.Flashcard,
  ElementType.Content,
  ElementType.Selection,
  ElementType.CaseStudy,
]

interface PracticeQuizWizardProps {
  title: string
  courses: ElementSelectCourse[]
  closeWizard: () => void
  initialValues?: Omit<
    PracticeQuiz,
    'id' | 'orderType' | 'resetTimeDays' | 'status'
  > & {
    id?: string
    orderType?: string
    resetTimeDays?: number
    status?: PublicationStatus
  }
  selection: Record<number, Element>
  resetSelection: () => void
  conversion: boolean
  editMode: boolean
  duplicationMode: boolean
}

function PracticeQuizWizard({
  title,
  courses,
  closeWizard,
  initialValues,
  selection,
  resetSelection,
  conversion,
  editMode,
  duplicationMode,
}: PracticeQuizWizardProps) {
  const t = useTranslations()

  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState<boolean[]>(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<PracticeQuizFormValues>>(null)
  const shouldLoadAdaptivePreview = Boolean(
    initialValues?.id && initialValues.mode === PracticeQuizMode.Adaptive
  )
  const [adaptiveValuesInitialized, setAdaptiveValuesInitialized] = useState(
    !shouldLoadAdaptivePreview
  )
  const {
    data: adaptivePreviewData,
    loading: adaptivePreviewLoading,
    error: adaptivePreviewError,
    refetch: refetchAdaptivePreview,
  } = useQuery(AdaptivePracticeQuizPreviewDocument, {
    variables: { id: initialValues?.id! },
    skip: !shouldLoadAdaptivePreview,
    fetchPolicy: 'network-only',
  })

  const { gamifiedCourses, nonGamifiedCourses, assessmentCourses } =
    useCoursesGamificationSplit({
      courseSelection: courses,
    })
  const adaptiveCourses = courses.filter(
    ({ isAdaptiveLearningEnabled }) => isAdaptiveLearningEnabled
  )
  const adaptiveCourseIds = new Set(adaptiveCourses.map(({ value }) => value))

  const optionalNumber = () =>
    yup
      .number()
      .transform((value, originalValue) =>
        originalValue === '' || originalValue === null ? null : value
      )
      .nullable()
      .typeError(t('manage.activityWizard.adaptive.validation.number'))
  const requiredNumber = () =>
    optionalNumber().required(
      t('manage.activityWizard.adaptive.validation.required')
    )

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
    courseId: yup
      .string()
      .required(t('manage.activityWizard.practiceQuizSelectCourse'))
      .test(
        'adaptive-course-enabled',
        t('manage.activityWizard.adaptive.validation.courseNotEnabled'),
        function (value) {
          return (
            this.parent.mode !== PracticeQuizMode.Adaptive ||
            (typeof value === 'string' && adaptiveCourseIds.has(value))
          )
        }
      ),
    order: yup
      .string()
      .required()
      .oneOf(
        Object.values(ElementOrderType),
        t('manage.activityWizard.practiceQuizOrder')
      ),
    resetTimeDays: yup
      .string()
      .required(t('manage.activityWizard.practiceQuizResetDays'))
      .matches(
        /^[0-9]+$/,
        t('manage.activityWizard.practiceQuizValidResetDays')
      ),
    adaptiveConfig: yup.object().shape({
      totalQuestionCap: requiredNumber()
        .integer(t('manage.activityWizard.adaptive.validation.integer'))
        .min(1, t('manage.activityWizard.adaptive.validation.positive'))
        .max(
          ADAPTIVE_MAX_QUESTION_CAP,
          t('manage.activityWizard.adaptive.validation.questionCapMax')
        ),
      perLeafQuestionCap: optionalNumber()
        .integer(t('manage.activityWizard.adaptive.validation.integer'))
        .min(1, t('manage.activityWizard.adaptive.validation.positive'))
        .max(
          ADAPTIVE_MAX_QUESTION_CAP,
          t('manage.activityWizard.adaptive.validation.questionCapMax')
        ),
      minQuestionsPerLeaf: requiredNumber()
        .integer(t('manage.activityWizard.adaptive.validation.integer'))
        .min(1, t('manage.activityWizard.adaptive.validation.positive'))
        .max(
          ADAPTIVE_MAX_QUESTION_CAP,
          t('manage.activityWizard.adaptive.validation.questionCapMax')
        ),
      classificationZ: requiredNumber()
        .moreThan(0, t('manage.activityWizard.adaptive.validation.positive'))
        .max(
          ADAPTIVE_MAX_CLASSIFICATION_Z,
          t('manage.activityWizard.adaptive.validation.classificationZMax')
        ),
      topInformationRatio: optionalNumber().when('preset', {
        is: AdaptivePracticeQuizPreset.Research,
        then: () =>
          requiredNumber()
            .moreThan(
              0,
              t('manage.activityWizard.adaptive.validation.positive')
            )
            .max(1, t('manage.activityWizard.adaptive.validation.ratioMax')),
      }),
      defaultDiscrimination: optionalNumber().when('preset', {
        is: AdaptivePracticeQuizPreset.Research,
        then: () =>
          optionalNumber()
            .moreThan(
              0,
              t('manage.activityWizard.adaptive.validation.positive')
            )
            .max(
              ADAPTIVE_MAX_DISCRIMINATION,
              t('manage.activityWizard.adaptive.validation.discriminationMax')
            ),
      }),
    }),
  })

  const adaptiveSetupValidationSchema = yup.object().shape({
    adaptiveConfig: yup.object().shape({
      competenceTreeId: yup
        .string()
        .required(t('manage.activityWizard.adaptive.validation.treeRequired')),
      nodeOverrides: yup.array().of(
        yup.object().shape({
          weight: optionalNumber().min(
            0,
            t('manage.activityWizard.adaptive.validation.nonNegative')
          ),
          questionCap: optionalNumber()
            .integer(t('manage.activityWizard.adaptive.validation.integer'))
            .min(1, t('manage.activityWizard.adaptive.validation.positive'))
            .max(
              ADAPTIVE_MAX_QUESTION_CAP,
              t('manage.activityWizard.adaptive.validation.questionCapMax')
            ),
        })
      ),
      elementOverrides: yup.array().of(
        yup.object().shape({
          discrimination: optionalNumber()
            .moreThan(
              0,
              t('manage.activityWizard.adaptive.validation.positive')
            )
            .max(
              ADAPTIVE_MAX_DISCRIMINATION,
              t('manage.activityWizard.adaptive.validation.discriminationMax')
            ),
        })
      ),
    }),
  })

  const stackValiationSchema = yup.object().shape({
    stacks: yup
      .array()
      .of(
        yup.object().shape({
          displayName: yup.string(),
          description: yup.string(),
          elements: yup
            .array()
            .min(1, t('manage.activityWizard.minOneElementPerStack'))
            .of(
              yup.object().shape({
                id: yup.number(),
                title: yup.string(),
                type: yup
                  .string()
                  .oneOf(
                    acceptedTypes,
                    t('manage.activityWizard.practiceQuizTypes')
                  ),
                hasSampleSolution: yup.boolean().when('type', {
                  is: (type: ElementType) => type !== ElementType.FreeText,
                  then: (schema) =>
                    schema.isTrue(
                      t('manage.activityWizard.elementSolutionReq')
                    ),
                }),
              })
            ),
        })
      )
      .min(1),
  })

  const formDefaultValues: PracticeQuizFormValues = {
    name: '',
    displayName: '',
    description: '',
    mode: PracticeQuizMode.Standard,
    adaptiveConfig: createAdaptivePracticeQuizDefaultConfig(),
    stacks: [createEmptyPracticeQuizStack()],
    multiplier: '1',
    courseId: undefined,
    order: ElementOrderType.SpacedRepetition,
    courseStartDate: undefined,
    resetTimeDays: '6',
  }

  const [formData, setFormData] = useState<PracticeQuizFormValues>({
    name: initialValues?.name || formDefaultValues.name,
    displayName: initialValues?.displayName || formDefaultValues.displayName,
    description: initialValues?.description || formDefaultValues.description,
    mode: initialValues?.mode ?? formDefaultValues.mode,
    adaptiveConfig: createAdaptivePracticeQuizDefaultConfig(),
    stacks:
      initialValues?.mode === PracticeQuizMode.Adaptive
        ? []
        : initialValues?.stacks
          ? initialValues.stacks.map((stack) => ({
              displayName: stack.displayName ?? '',
              description: stack.description ?? '',
              elements: stack.elements!.map((instance) => {
                const [elementId, _] = instance.elementData.id.split('-v')

                return {
                  id: parseInt(elementId),
                  title: instance.elementData.name,
                  type: instance.elementData.type,
                  hasSampleSolution:
                    'options' in instance.elementData
                      ? (instance.elementData.options.hasSampleSolution ??
                        false)
                      : true,
                  existingInstanceId: instance.id,
                  duplicateInstance: duplicationMode || conversion,
                }
              }),
            }))
          : formDefaultValues.stacks,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
    courseId: initialValues?.course?.id || formDefaultValues.courseId,
    order:
      (initialValues?.orderType as ElementOrderType) || formDefaultValues.order,
    courseStartDate: formDefaultValues.courseStartDate,
    resetTimeDays:
      typeof initialValues?.resetTimeDays !== 'undefined'
        ? String(initialValues?.resetTimeDays)
        : formDefaultValues.resetTimeDays,
  })

  const adaptiveInitialPreview =
    adaptivePreviewData?.adaptivePracticeQuizPreview

  useEffect(() => {
    if (adaptiveValuesInitialized || !adaptiveInitialPreview) return

    setFormData((previous) => ({
      ...previous,
      mode: PracticeQuizMode.Adaptive,
      stacks: [],
      multiplier: '0',
      adaptiveConfig: mapAdaptivePracticeQuizPreviewToForm(
        adaptiveInitialPreview
      ),
    }))
    setAdaptiveValuesInitialized(true)
  }, [adaptiveInitialPreview, adaptiveValuesInitialized])

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.activityWizard.practiceQuizInformation'),
      completed: stepValidity[0],
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.activityWizard.practiceQuizDescription'),
      completed: stepValidity[1],
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.activityWizard.practiceQuizSettings'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[2],
    },
    {
      title:
        formData.mode === PracticeQuizMode.Adaptive
          ? t('manage.activityWizard.adaptive.setup.title')
          : t('shared.generic.questions'),
      tooltip:
        formData.mode === PracticeQuizMode.Adaptive
          ? t('manage.activityWizard.adaptive.setup.tooltip')
          : t('manage.activityWizard.practiceQuizContent'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[3],
    },
  ]

  const [createPracticeQuiz, { data: creationData }] = useMutation(
    CreatePracticeQuizDocument
  )
  const [editPracticeQuiz, { data: editingData }] = useMutation(
    EditPracticeQuizDocument
  )
  const handleSubmit = useCallback(
    async (values: PracticeQuizFormValues) => {
      submitPracticeQuizForm({
        id: initialValues?.id,
        previousCourseId: initialValues?.course?.id,
        values,
        editMode,
        createPracticeQuiz,
        editPracticeQuiz,
        setIsWizardCompleted,
        translate: asAdaptiveTranslator(t),
        onError: (details) =>
          toast({
            type: 'error',
            message: (
              <div>
                <div>
                  {editMode
                    ? t('manage.activityWizard.practiceQuizEditingFailed')
                    : t('manage.activityWizard.practiceQuizCreationFailed')}
                </div>
                <div>{t('manage.activityWizard.considerFormErrors')}</div>
                {details ? (
                  <div className="mt-1 font-mono text-xs">{details}</div>
                ) : null}
              </div>
            ),
            options: { duration: 6000 },
          }),
      })
    },
    [
      createPracticeQuiz,
      editMode,
      editPracticeQuiz,
      initialValues?.course?.id,
      initialValues?.id,
      t,
    ]
  )

  if (
    shouldLoadAdaptivePreview &&
    (adaptivePreviewLoading ||
      (!adaptiveValuesInitialized && Boolean(adaptiveInitialPreview)))
  ) {
    return <Loader />
  }

  if (
    shouldLoadAdaptivePreview &&
    (adaptivePreviewError || !adaptiveInitialPreview)
  ) {
    return (
      <div className="flex flex-col gap-3">
        <UserNotification
          type="error"
          message={
            adaptivePreviewError?.message ??
            t('manage.activityWizard.adaptive.loadFailed')
          }
          data={{ cy: 'adaptive-practice-quiz-load-error' }}
        />
        <Button
          type="button"
          onClick={() => void refetchAdaptivePreview()}
          data={{ cy: 'retry-adaptive-practice-quiz-load' }}
          className={{ root: 'w-max' }}
        >
          <Button.Label>{t('shared.generic.tryAgain')}</Button.Label>
        </Button>
      </div>
    )
  }

  const activityId =
    creationData?.createPracticeQuiz?.id ?? editingData?.editPracticeQuiz?.id
  const selectedCourseId =
    creationData?.createPracticeQuiz?.courseId ??
    editingData?.editPracticeQuiz?.courseId
  const isActivityReviewer =
    creationData?.createPracticeQuiz?.isActivityReviewer ??
    editingData?.editPracticeQuiz?.isActivityReviewer

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
                ? t.rich('manage.activityWizard.practiceQuizUpdated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })
                : t.rich('manage.activityWizard.practiceQuizCreated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })}
            </div>
          )}
          name={formData.name}
          editMode={editMode}
          previewElementHref={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${selectedCourseId}/practiceQuizzes/${activityId}`}
          viewElementHref={
            isActivityReviewer
              ? `/courses/${selectedCourseId}?tab=practiceQuizzes`
              : '/activities'
          }
          onRestartForm={() => {
            setIsWizardCompleted(false)
            closeWizard()
          }}
          resetForm={() => setFormData(formDefaultValues)}
          setStepNumber={setActiveStep}
          onCloseWizard={closeWizard}
        />
      }
      steps={[
        <PracticeQuizInformationStep
          key="practice-quiz-information-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={
            gamifiedCourses?.length === 0 && nonGamifiedCourses?.length === 0
          }
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={nameValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
          adaptiveCourses={adaptiveCourses}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<PracticeQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onModeChange={(newValues) => {
            setFormData(newValues)
            setStepValidity((previous) => [previous[0], false, false, false])
          }}
          closeWizard={closeWizard}
        />,
        <PracticeQuizDescriptionStep
          key="practice-quiz-description-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={descriptionValidationSchema}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<PracticeQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<PracticeQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizard}
        />,
        <PracticeQuizSettingsStep
          key="practice-quiz-settings-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={settingsValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
          assessmentCourses={assessmentCourses}
          adaptiveCourses={adaptiveCourses}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<PracticeQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<PracticeQuizFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizard}
        />,
        formData.mode === PracticeQuizMode.Adaptive ? (
          <AdaptivePracticeQuizSetupStep
            key="adaptive-practice-quiz-setup-step"
            editMode={editMode}
            formRef={formRef}
            formData={formData}
            continueDisabled={false}
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={adaptiveSetupValidationSchema}
            adaptiveInitialPreview={adaptiveInitialPreview ?? undefined}
            setStepValidity={setStepValidity}
            onPrevStep={(newValues: Partial<PracticeQuizFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep - 1)
            }}
            onSubmit={(newValues: PracticeQuizFormValues) =>
              handleSubmit({ ...formData, ...newValues })
            }
            closeWizard={closeWizard}
          />
        ) : (
          <StackCreationStep
            key="practice-quiz-stack-step"
            editMode={editMode}
            selection={selection}
            resetSelection={resetSelection}
            acceptedTypes={acceptedTypes}
            formRef={formRef}
            formData={formData}
            continueDisabled={false}
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={stackValiationSchema}
            setStepValidity={setStepValidity}
            onPrevStep={(newValues: Partial<PracticeQuizFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep - 1)
            }}
            onSubmit={(newValues: PracticeQuizFormValues) =>
              handleSubmit({ ...formData, ...newValues })
            }
            closeWizard={closeWizard}
          />
        ),
      ]}
      saveFormData={() => {
        setFormData((prev) => ({ ...prev, ...formRef.current?.values }))
      }}
    />
  )
}

export default PracticeQuizWizard
