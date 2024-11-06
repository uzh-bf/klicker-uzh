import { useMutation } from '@apollo/client'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateLiveQuizDocument,
  EditLiveQuizDocument,
  Element,
  ElementType,
  GetUserRunningLiveQuizzesDocument,
  LiveQuiz,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import useCoursesGamificationSplit from '@lib/hooks/useCoursesGamificationSplit'
import { Button } from '@uzh-bf/design-system'
import { FormikProps } from 'formik'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import { ElementSelectCourse } from '../../ElementCreation'
import CompletionStep from '../CompletionStep'
import WizardLayout, { LiveQuizFormValues } from '../WizardLayout'
import LiveQuizDescriptionStep from './LiveQuizDescriptionStep'
import LiveQuizInformationStep from './LiveQuizInformationStep'
import LiveQuizQuestionsStep from './LiveQuizQuestionsStep'
import LiveQuizSettingsStep from './LiveQuizSettingsStep'
import submitLiveQuizForm from './submitLiveQuizForm'

export interface LiveQuizWizardStepProps {
  editMode: boolean
  formRef: any
  formData: LiveQuizFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
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
    | 'maxBonusPoints'
    | 'timeToZeroBonus'
    | 'isConfusionFeedbackEnabled'
    | 'isGamificationEnabled'
    | 'isLiveQAEnabled'
    | 'isModerationEnabled'
    | 'blocks'
  > & { course?: { id: string } | null }
  selection: Record<number, Element>
  resetSelection: () => void
  closeWizard: () => void
  editMode: boolean
}

function LiveQuizWizard({
  title,
  courses,
  initialValues,
  selection,
  resetSelection,
  closeWizard,
  editMode,
}: LiveQuizWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<LiveQuizFormValues>>(null)

  const { gamifiedCourses, nonGamifiedCourses } = useCoursesGamificationSplit({
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
        questionIds: yup.array().of(yup.number()),
        titles: yup.array().of(yup.string()),
        types: yup
          .array()
          .of(
            yup
              .string()
              .oneOf(
                [
                  ElementType.Sc,
                  ElementType.Mc,
                  ElementType.Kprim,
                  ElementType.Numerical,
                  ElementType.FreeText,
                ],
                t('manage.activityWizard.liveQuizTypes')
              )
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
    courseId: '',
    multiplier: '1',
    maxBonusPoints: LQ_MAX_BONUS_POINTS,
    timeToZeroBonus: LQ_TIME_TO_ZERO_BONUS,
    isGamificationEnabled: false,
    isConfusionFeedbackEnabled: true,
    isLiveQAEnabled: false,
    isModerationEnabled: true,
  }

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.activityWizard.liveQuizInformation'),
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.activityWizard.liveQuizDescription'),
      tooltipDisabled: t('manage.activityWizard.liveQuizDescription'),
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.activityWizard.liveQuizSettings'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
    },
    {
      title: t('manage.activityWizard.liveQuizBlocks'),
      tooltip: t('manage.activityWizard.liveQuizDragDrop'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
    },
  ]

  const [formData, setFormData] = useState<LiveQuizFormValues>({
    name: initialValues?.name || formDefaultValues.name,
    displayName: initialValues?.displayName || formDefaultValues.displayName,
    description: initialValues?.description || formDefaultValues.description,
    blocks: initialValues?.blocks
      ? initialValues.blocks.map((block) => {
          return {
            timeLimit: block.timeLimit ?? undefined,
            elements: block.elements!.map((element) => {
              return {
                id: parseInt(element.elementData.id),
                title: element.elementData.name,
                type: element.elementData.type,
                hasSampleSolution:
                  'options' in element.elementData
                    ? (element.elementData.options.hasSampleSolution ?? false)
                    : true,
              }
            }),
          }
        })
      : formDefaultValues.blocks,
    courseId: initialValues?.course?.id || formDefaultValues.courseId,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
    maxBonusPoints:
      initialValues?.maxBonusPoints ?? formDefaultValues.maxBonusPoints,
    timeToZeroBonus:
      initialValues?.timeToZeroBonus ?? formDefaultValues.timeToZeroBonus,
    isGamificationEnabled:
      initialValues?.isGamificationEnabled ??
      formDefaultValues.isGamificationEnabled,
    isConfusionFeedbackEnabled:
      initialValues?.isConfusionFeedbackEnabled ??
      formDefaultValues.isConfusionFeedbackEnabled,
    isLiveQAEnabled:
      initialValues?.isLiveQAEnabled ?? formDefaultValues.isLiveQAEnabled,
    isModerationEnabled:
      initialValues?.isModerationEnabled ??
      formDefaultValues.isModerationEnabled,
  })

  const [editLiveQuiz] = useMutation(EditLiveQuizDocument)
  const [createLiveQuiz, { data }] = useMutation(CreateLiveQuizDocument)
  const [startLiveQuiz] = useMutation(StartLiveQuizDocument, {
    update(cache, res) {
      const data = cache.readQuery({
        query: GetUserRunningLiveQuizzesDocument,
      })
      cache.writeQuery({
        query: GetUserRunningLiveQuizzesDocument,
        data: {
          userRunningLiveQuizzes: res.data?.startLiveQuiz
            ? [
                ...(data?.userRunningLiveQuizzes ?? []),
                {
                  id: res.data?.startLiveQuiz?.id,
                  name: res.data.startLiveQuiz.name ?? '',
                },
              ]
            : (data?.userRunningLiveQuizzes ?? []),
        },
      })
    },
  })

  const handleSubmit = useCallback(
    async (values: LiveQuizFormValues) => {
      submitLiveQuizForm({
        id: initialValues?.id,
        editMode,
        values,
        createLiveQuiz,
        editLiveQuiz,
        setIsWizardCompleted,
        setErrorToastOpen,
      })
    },
    [createLiveQuiz, editMode, editLiveQuiz, initialValues?.id]
  )

  return (
    <>
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
            onViewElement={() => {
              router.push(`/sessions`)
            }}
            onRestartForm={() => {
              setIsWizardCompleted(false)
              closeWizard()
            }}
            resetForm={() => setFormData(formDefaultValues)}
            setStepNumber={setActiveStep}
            onCloseWizard={closeWizard}
          >
            {!editMode && data?.createLiveQuiz?.id ? (
              <Button
                data={{ cy: 'quick-start' }}
                onClick={async () => {
                  await startLiveQuiz({
                    variables: {
                      id: data.createLiveQuiz!.id,
                    },
                  })
                  router.push(`/sessions/${data.createLiveQuiz!.id}/cockpit`)
                }}
                className={{ root: 'space-x-1' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faPlay} />
                </Button.Icon>
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
            formRef={formRef}
            formData={formData}
            continueDisabled={false}
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={settingsValidationSchema}
            gamifiedCourses={gamifiedCourses}
            nonGamifiedCourses={nonGamifiedCourses}
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
      <ElementCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? t('manage.activityWizard.liveQuizEditingFailed')
            : t('manage.activityWizard.liveQuizCreationFailed')
        }
      />
    </>
  )
}

export default LiveQuizWizard
