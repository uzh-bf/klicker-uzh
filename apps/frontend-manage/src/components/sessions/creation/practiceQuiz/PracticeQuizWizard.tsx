import { useMutation } from '@apollo/client'
import {
  CreatePracticeQuizDocument,
  EditPracticeQuizDocument,
  Element,
  ElementOrderType,
  ElementType,
  PracticeQuiz,
} from '@klicker-uzh/graphql/dist/ops'
import useCoursesGamificationSplit from '@lib/hooks/useCoursesGamificationSplit'
import dayjs from 'dayjs'
import { FormikProps } from 'formik'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import CompletionStep from '../CompletionStep'
import { ElementSelectCourse } from '../ElementCreation'
import StackCreationStep from '../StackCreationStep'
import WizardLayout, { PracticeQuizFormValues } from '../WizardLayout'
import PracticeQuizDescriptionStep from './PracticeQuizDescriptionStep'
import PracticeQuizInformationStep from './PracticeQuizInformationStep'
import PracticeQuizSettingsStep from './PracticeQuizSettingsStep'
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
  onSubmit?: (newValues: PracticeQuizFormValues) => void
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
]

interface PracticeQuizWizardProps {
  title: string
  courses: ElementSelectCourse[]
  closeWizard: () => void
  initialValues?: PracticeQuiz
  selection: Record<number, Element>
  resetSelection: () => void
  editMode: boolean
  conversion: boolean
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
}: PracticeQuizWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(
    undefined
  )
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<PracticeQuizFormValues>>(null)

  const { gamifiedCourses, nonGamifiedCourses } = useCoursesGamificationSplit({
    courseSelection: courses,
  })

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
    courseId: yup
      .string()
      .required(t('manage.sessionForms.practiceQuizSelectCourse')),
    order: yup
      .string()
      .required()
      .oneOf(
        Object.values(ElementOrderType),
        t('manage.sessionForms.practiceQuizOrder')
      ),
    availableFrom: yup.date(),
    resetTimeDays: yup
      .string()
      .required(t('manage.sessionForms.practiceQuizResetDays'))
      .matches(/^[0-9]+$/, t('manage.sessionForms.practiceQuizValidResetDays')),
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
            .min(1, t('manage.sessionForms.minOneElementPerStack'))
            .of(
              yup.object().shape({
                id: yup.number(),
                title: yup.string(),
                type: yup
                  .string()
                  .oneOf(
                    acceptedTypes,
                    t('manage.sessionForms.practiceQuizTypes')
                  ),
                hasSampleSolution: yup.boolean().when('type', {
                  is: (type: ElementType) => type !== ElementType.FreeText,
                  then: (schema) =>
                    schema.isTrue(t('manage.sessionForms.elementSolutionReq')),
                }),
              })
            ),
        })
      )
      .min(1),
  })

  const formDefaultValues = {
    name: '',
    displayName: '',
    description: '',
    stacks: [
      {
        displayName: '',
        description: '',
        elements: [],
      },
    ],
    multiplier: '1',
    courseId: undefined,
    order: ElementOrderType.SpacedRepetition,
    availableFrom: dayjs().local().format('YYYY-MM-DDTHH:mm'),
    resetTimeDays: '6',
  }

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.sessionForms.practiceQuizInformation'),
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.sessionForms.practiceQuizDescription'),
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.sessionForms.practiceQuizSettings'),
      tooltipDisabled: t('manage.sessionForms.checkValues'),
    },
    {
      title: t('shared.generic.questions'),
      tooltip: t('manage.sessionForms.practiceQuizContent'),
      tooltipDisabled: t('manage.sessionForms.checkValues'),
    },
  ]

  const [formData, setFormData] = useState<PracticeQuizFormValues>({
    name: initialValues?.name || formDefaultValues.name,
    displayName: initialValues?.displayName || formDefaultValues.displayName,
    description: initialValues?.description || formDefaultValues.description,
    stacks: initialValues?.stacks
      ? initialValues.stacks.map((stack) => {
          return {
            displayName: stack.displayName ?? '',
            description: stack.description ?? '',
            elements: stack.elements!.map((element) => {
              return {
                id: parseInt(element.elementData.id),
                title: element.elementData.name,
                type: element.elementData.type,
                hasSampleSolution:
                  element.elementData.options.hasSampleSolution ?? true,
              }
            }),
          }
        })
      : formDefaultValues.stacks,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
    courseId: initialValues?.course?.id || formDefaultValues.courseId,
    order: initialValues?.orderType || formDefaultValues.order,
    availableFrom: initialValues?.availableFrom
      ? dayjs(initialValues?.availableFrom).local().format('YYYY-MM-DDTHH:mm')
      : formDefaultValues.availableFrom,
    resetTimeDays: initialValues?.resetTimeDays
      ? String(initialValues?.resetTimeDays)
      : formDefaultValues.resetTimeDays,
  })

  const [createPracticeQuiz] = useMutation(CreatePracticeQuizDocument)
  const [editPracticeQuiz] = useMutation(EditPracticeQuizDocument)
  const handleSubmit = useCallback(
    async (values: PracticeQuizFormValues) => {
      submitPracticeQuizForm({
        id: initialValues?.id,
        values,
        createPracticeQuiz,
        editPracticeQuiz,
        setSelectedCourseId,
        setIsWizardCompleted,
        setErrorToastOpen,
        editMode,
      })
    },
    [createPracticeQuiz, editMode, editPracticeQuiz, initialValues?.id]
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
                  ? t.rich('manage.sessionForms.practiceQuizUpdated', {
                      b: (text) => <strong>{text}</strong>,
                      name: elementName,
                    })
                  : t.rich('manage.sessionForms.practiceQuizCreated', {
                      b: (text) => <strong>{text}</strong>,
                      name: elementName,
                    })}
              </div>
            )}
            name={formData.name}
            editMode={editMode}
            onViewElement={() => {
              router.push(`/courses/${selectedCourseId}?tab=practiceQuizzes`)
            }}
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
            setStepValidity={setStepValidity}
            onNextStep={(newValues: Partial<PracticeQuizFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep + 1)
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
            ? t('manage.sessionForms.practiceQuizEditingFailed')
            : t('manage.sessionForms.practiceQuizCreationFailed')
        }
      />
    </>
  )
}

export default PracticeQuizWizard
