import { useMutation } from '@apollo/client'
import {
  CreateSessionDocument,
  EditSessionDocument,
  Element,
  ElementType,
  Session,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useRef, useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import CompletionStep from '../CompletionStep'
import { ElementSelectCourse } from '../ElementCreation'
import { LiveSessionFormValues } from '../MultistepWizard'
import WizardLayout from '../WizardLayout'
import LiveQuizDescriptionStep from './LiveQuizDescriptionStep'
import LiveQuizInformationStep from './LiveQuizInformationStep'
import LiveQuizQuestionsStep from './LiveQuizQuestionsStep'
import LiveQuizSettingsStep from './LiveQuizSettingsStep'
import submitLiveSessionForm from './submitLiveSessionForm'

export interface LiveQuizWizardStepProps {
  editMode: boolean
  formRef: any
  formData: LiveSessionFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  onSubmit?: (newValues: LiveSessionFormValues) => void
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onNextStep?: (newValues: LiveSessionFormValues) => void
  closeWizard: () => void
}

interface LiveSessionWizardProps {
  title: string
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  initialValues?: Partial<Session>
  selection: Record<number, Element>
  resetSelection: () => void
  closeWizard: () => void
  editMode: boolean
}

function LiveSessionWizard({
  title,
  gamifiedCourses,
  nonGamifiedCourses,
  initialValues,
  selection,
  resetSelection,
  closeWizard,
  editMode,
}: LiveSessionWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<any>(null)

  const nameValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.sessionForms.sessionName')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.sessionForms.sessionDisplayName')),
    description: yup.string(),
  })

  const settingsValidationSchema = yup.object().shape({
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
    courseId: yup.string(),
    isGamificationEnabled: yup
      .boolean()
      .required(t('manage.sessionForms.liveQuizGamified')),
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
                t('manage.sessionForms.liveQuizTypes')
              )
          ),
        timeLimit: yup
          .number()
          .min(1, t('manage.sessionForms.liveQuizTimeRestriction')),
      })
    ),
  })

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.sessionForms.liveQuizInformation'),
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.sessionForms.liveQuizDescription'),
      tooltipDisabled: t('manage.sessionForms.liveQuizDescription'),
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.sessionForms.liveQuizSettings'),
      tooltipDisabled: t('manage.sessionForms.checkValues'),
    },
    {
      title: t('manage.sessionForms.liveQuizBlocks'),
      tooltip: t('manage.sessionForms.liveQuizDragDrop'),
      tooltipDisabled: t('manage.sessionForms.checkValues'),
    },
  ]

  const formDefaultValues = {
    name: '',
    displayName: '',
    description: '',
    blocks: [{ questionIds: [], titles: [], types: [], timeLimit: undefined }],
    courseId: '',
    multiplier: '1',
    isGamificationEnabled: false,
    isConfusionFeedbackEnabled: true,
    isLiveQAEnabled: false,
    isModerationEnabled: true,
  }

  const [formData, setFormData] = useState<LiveSessionFormValues>({
    name: initialValues?.name || formDefaultValues.name,
    displayName: initialValues?.displayName || formDefaultValues.displayName,
    description: initialValues?.description || formDefaultValues.description,
    blocks:
      initialValues?.blocks?.map((block) => {
        return {
          questionIds:
            block.instances?.map(
              (instance) => instance.questionData!.questionId!
            ) ?? [],
          titles:
            block.instances?.map((instance) => instance.questionData!.name!) ??
            [],
          types:
            block.instances?.map((instance) => instance.questionData!.type) ??
            [],
          timeLimit: block.timeLimit ?? undefined,
        }
      }) || formDefaultValues.blocks,
    courseId: initialValues?.course?.id || formDefaultValues.courseId,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
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

  const [editSession] = useMutation(EditSessionDocument)
  const [createSession, { data }] = useMutation(CreateSessionDocument)
  const [startSession] = useMutation(StartSessionDocument)
  const handleSubmit = async (values: LiveSessionFormValues) => {
    submitLiveSessionForm({
      id: initialValues?.id,
      editMode,
      values,
      createLiveSession: createSession,
      editLiveSession: editSession,
      setIsWizardCompleted,
      setErrorToastOpen,
    })
  }

  return (
    <>
      {/* <MultistepWizard
        title={title}
        onCloseWizard={closeWizard}
        completionSuccessMessage={(elementName) => (
          <div>
            {editMode
              ? t.rich('manage.sessionForms.liveQuizUpdated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.liveQuizCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })}
          </div>
        )}
        customCompletionAction={
          !editMode &&
          data?.createSession?.id && (
            <Button
              data={{ cy: 'quick-start' }}
              onClick={async () => {
                await startSession({
                  variables: {
                    id: data?.createSession?.id as string,
                  },
                })
                router.push(`/sessions/${data?.createSession?.id}/cockpit`)
              }}
              className={{ root: 'space-x-1' }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faPlay} />
              </Button.Icon>
              <Button.Label>
                {t('manage.sessionForms.liveQuizStartNow')}
              </Button.Label>
            </Button>
          )
        }
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          blocks: initialValues?.blocks?.map((block) => {
            return {
              questionIds: block.instances?.map(
                (instance) => instance.questionData!.questionId
              ),
              titles: block.instances?.map(
                (instance) => instance.questionData!.name
              ),
              types: block.instances?.map(
                (instance) => instance.questionData!.type
              ),
              timeLimit: block.timeLimit ?? undefined,
            }
          }) || [
            { questionIds: [], titles: [], types: [], timeLimit: undefined },
          ],
          courseId: initialValues?.course?.id || '',
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          isGamificationEnabled: initialValues?.isGamificationEnabled ?? false,
          isConfusionFeedbackEnabled:
            initialValues?.isConfusionFeedbackEnabled ?? true,
          isLiveQAEnabled: initialValues?.isLiveQAEnabled ?? false,
          isModerationEnabled: initialValues?.isModerationEnabled ?? true,
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        editMode={editMode}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/sessions`)
        }}
        workflowItems={workflowItems}
      >
        <LiveQuizInformationStep validationSchema={nameValidationSchema} />
        <LiveQuizDescriptionStep
          validationSchema={descriptionValidationSchema}
        />
        <LiveQuizSettingsStep
          validationSchema={settingsValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
        />
        <LiveQuizQuestionsStep
          validationSchema={questionsValidationSchema}
          selection={selection}
          resetSelection={resetSelection}
        />
      </MultistepWizard> */}
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
                  ? t.rich('manage.sessionForms.liveQuizUpdated', {
                      b: (text) => <strong>{text}</strong>,
                      name: elementName,
                    })
                  : t.rich('manage.sessionForms.liveQuizCreated', {
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
            }}
            resetForm={() => setFormData(formDefaultValues)}
            setStepNumber={setActiveStep}
            onCloseWizard={closeWizard}
          />
        }
        steps={[
          <LiveQuizInformationStep
            editMode={editMode}
            formRef={formRef}
            formData={formData}
            continueDisabled={false}
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={nameValidationSchema}
            setStepValidity={setStepValidity}
            onNextStep={(newValues: Partial<LiveSessionFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep + 1)
            }}
            closeWizard={closeWizard}
          />,
          <LiveQuizDescriptionStep
            editMode={editMode}
            formRef={formRef}
            formData={formData}
            continueDisabled={false}
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={descriptionValidationSchema}
            setStepValidity={setStepValidity}
            onNextStep={(newValues: Partial<LiveSessionFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep + 1)
            }}
            closeWizard={closeWizard}
          />,
          <LiveQuizSettingsStep
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
            onNextStep={(newValues: Partial<LiveSessionFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep + 1)
            }}
            closeWizard={closeWizard}
          />,
          <LiveQuizQuestionsStep
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
            onSubmit={(newValues: LiveSessionFormValues) =>
              handleSubmit({ ...formData, ...newValues })
            }
            closeWizard={closeWizard}
          />,
        ]}
        saveFormData={() => {
          setFormData((prev) => ({ ...prev, ...formRef.current.values }))
        }}
      />
      <ElementCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? t('manage.sessionForms.liveQuizEditingFailed')
            : t('manage.sessionForms.liveQuizCreationFailed')
        }
      />
    </>
  )
}

export default LiveSessionWizard
