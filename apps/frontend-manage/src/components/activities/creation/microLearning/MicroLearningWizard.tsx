import { useMutation } from '@apollo/client'
import {
  CreateMicroLearningDocument,
  EditMicroLearningDocument,
  Element,
  ElementType,
  MicroLearning,
} from '@klicker-uzh/graphql/dist/ops'
import { getCodeActivityStackViolation } from '@klicker-uzh/types'
import useCoursesGamificationSplit from '@lib/hooks/useCoursesGamificationSplit'
import { toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { FormikProps } from 'formik'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react'
import * as yup from 'yup'
import { ElementSelectCourse } from '../../ActivityCreation'
import CompletionStep from '../CompletionStep'
import StackCreationStep from '../StackCreationStep'
import WizardLayout, { MicroLearningFormValues } from '../WizardLayout'
import MicroLearningDescriptionStep from './MicroLearningDescriptionStep'
import MicroLearningInformationStep from './MicroLearningInformationStep'
import MicroLearningSettingsStep from './MicroLearningSettingsStep'
import submitMicrolearningForm from './submitMicrolearningForm'

export interface MicroLearningWizardStepProps {
  editMode: boolean
  formRef: any
  formData: MicroLearningFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  assessmentCourses?: ElementSelectCourse[]
  onSubmit?: (newValues: MicroLearningFormValues) => Promise<void>
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onPrevStep?: (newValues: MicroLearningFormValues) => void
  onNextStep?: (newValues: MicroLearningFormValues) => void
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
  ElementType.Code,
]

interface MicroLearningWizardProps {
  title: string
  courses: ElementSelectCourse[]
  initialValues?: MicroLearning
  selection: Record<number, Element>
  resetSelection: () => void
  closeWizard: () => void
  editMode: boolean
  duplicationMode: boolean
}

function MicroLearningWizard({
  title,
  courses,
  initialValues,
  selection,
  resetSelection,
  closeWizard,
  editMode,
  duplicationMode,
}: MicroLearningWizardProps) {
  const t = useTranslations()
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState<boolean[]>(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<MicroLearningFormValues>>(null)

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
    startDate: yup
      .date()
      .required(t('manage.activityWizard.startDate'))
      .test(
        'afterCourseStart',
        t('manage.activityWizard.microlearningStartAfterCourseStart'),
        (value, context) =>
          context.parent.courseStartDate
            ? dayjs(value) > dayjs(context.parent.courseStartDate)
            : true
      ),
    endDate: yup
      .date()
      .required(t('manage.activityWizard.endDate'))
      .test(
        'checkDateInPast',
        t('manage.activityWizard.endInFuture'),
        (date) => {
          return !!(date && date > new Date())
        }
      )
      .when('startDate', (startDate, schema) =>
        schema.min(startDate, t('manage.activityWizard.endAfterStart'))
      )
      .test(
        'beforeCourseEnd',
        t('manage.activityWizard.microlearningEndBeforeCourseEnd'),
        (value, context) =>
          context.parent.courseEndDate
            ? dayjs(value) < dayjs(context.parent.courseEndDate)
            : true
      ),
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.activityWizard.validMultiplicator')),
    courseId: yup
      .string()
      .required(t('manage.activityWizard.microlearningCourse')),
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
                    t('manage.activityWizard.microlearningTypes')
                  ),
                hasSampleSolution: yup.boolean().when('type', {
                  is: (type: ElementType) =>
                    type !== ElementType.FreeText && type !== ElementType.Code,
                  then: (schema) =>
                    schema.isTrue(
                      t('manage.activityWizard.elementSolutionReq')
                    ),
                }),
              })
            )
            .test(
              'code-only-stack',
              t('manage.activityWizard.codeOnlyStack'),
              (elements) =>
                getCodeActivityStackViolation(
                  (elements ?? []).flatMap((element) =>
                    element?.type ? [element.type] : []
                  ),
                  true
                ) === null
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
    startDate: dayjs()
      .startOf('month')
      .add(1, 'month')
      .add(12, 'hours')
      .toDate(),
    endDate: dayjs()
      .startOf('month')
      .add(1, 'month')
      .add(1, 'day')
      .add(12, 'hours')
      .toDate(),
    courseStartDate: undefined,
    courseEndDate: undefined,
    multiplier: '1',
    courseId: undefined,
  }

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.activityWizard.microLearningInformation'),
      completed: stepValidity[0],
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.activityWizard.microlearningDescription'),
      tooltipDisabled: t('manage.activityWizard.microlearningDescription'),
      completed: stepValidity[1],
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.activityWizard.microlearningSettings'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[2],
    },
    {
      title: t('shared.generic.questions'),
      tooltip: t('manage.activityWizard.microlearningQuestions'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[3],
    },
  ]

  const [formData, setFormData] = useState<MicroLearningFormValues>({
    name: initialValues?.name || formDefaultValues.name,
    displayName: initialValues?.displayName || formDefaultValues.displayName,
    description: initialValues?.description || formDefaultValues.description,
    stacks: initialValues?.stacks
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
                'options' in instance.elementData &&
                'hasSampleSolution' in instance.elementData.options
                  ? (instance.elementData.options.hasSampleSolution ?? false)
                  : true,
              existingInstanceId: instance.id,
              duplicateInstance: duplicationMode,
            }
          }),
        }))
      : formDefaultValues.stacks,
    startDate: initialValues?.scheduledStartAt
      ? dayjs(initialValues?.scheduledStartAt).local().toDate()
      : formDefaultValues.startDate,
    endDate: initialValues?.scheduledEndAt
      ? dayjs(initialValues?.scheduledEndAt).local().toDate()
      : formDefaultValues.endDate,
    courseStartDate: formDefaultValues.courseStartDate,
    courseEndDate: formDefaultValues.courseEndDate,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
    courseId: initialValues?.course?.id ?? formDefaultValues.courseId,
  })

  const [createMicroLearning, { data: creationData }] = useMutation(
    CreateMicroLearningDocument
  )
  const [editMicroLearning, { data: editingData }] = useMutation(
    EditMicroLearningDocument
  )
  const handleSubmit = useCallback(
    (values: MicroLearningFormValues) => {
      return submitMicrolearningForm({
        id: initialValues?.id,
        previousCourseId: initialValues?.course?.id,
        values,
        editMode,
        createMicroLearning,
        editMicroLearning,
        setIsWizardCompleted,
        onError: () =>
          toast({
            type: 'error',
            message: (
              <div>
                <div>
                  {editMode
                    ? t('manage.activityWizard.microlearningEditingFailed')
                    : t('manage.activityWizard.microlearningCreationFailed')}
                </div>
                <div>{t('manage.activityWizard.considerFormErrors')}</div>
              </div>
            ),
            options: { duration: 6000 },
          }),
      })
    },
    [createMicroLearning, editMicroLearning, editMode, initialValues?.id]
  )

  const activityId =
    creationData?.createMicroLearning?.id ?? editingData?.editMicroLearning?.id
  const selectedCourseId =
    creationData?.createMicroLearning?.courseId ??
    editingData?.editMicroLearning?.courseId
  const isActivityReviewer =
    creationData?.createMicroLearning?.isActivityReviewer ??
    editingData?.editMicroLearning?.isActivityReviewer

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
                ? t.rich('manage.activityWizard.microlearningCreated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })
                : t.rich('manage.activityWizard.microlearningEdited', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })}
            </div>
          )}
          name={formData.name}
          editMode={editMode}
          previewElementHref={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${selectedCourseId}/microLearnings/${activityId}/`}
          viewElementHref={
            isActivityReviewer
              ? `/courses/${selectedCourseId}?tab=microLearnings`
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
        <MicroLearningInformationStep
          key="micro-learning-information-step"
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
          onNextStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          closeWizard={closeWizard}
        />,
        <MicroLearningDescriptionStep
          key="micro-learning-description-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={descriptionValidationSchema}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizard}
        />,
        <MicroLearningSettingsStep
          key="micro-learning-settings-step"
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
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizard}
        />,
        <StackCreationStep
          key="stack-creation-step"
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
          onPrevStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          onSubmit={(newValues: MicroLearningFormValues) =>
            handleSubmit({ ...formData, ...newValues })
          }
          closeWizard={closeWizard}
        />,
      ]}
      saveFormData={() => {
        setFormData((prev) => ({ ...prev, ...formRef.current?.values }))
      }}
    />
  )
}

export default MicroLearningWizard
