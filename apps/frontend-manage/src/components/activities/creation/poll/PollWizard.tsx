import { useMutation } from '@apollo/client'
import {
  CreatePollDocument,
  EditPollDocument,
  Element,
  ElementType,
  Poll,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { FormikProps } from 'formik'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react'
import * as yup from 'yup'
import CompletionStep from '../CompletionStep'
import StackCreationStep from '../StackCreationStep'
import WizardLayout, { PollFormValues } from '../WizardLayout'
import PollDescriptionStep from './PollDescriptionStep'
import PollInformationStep from './PollInformationStep'
import submitPollForm from './submitPollForm'

export interface PollWizardStepProps {
  editMode: boolean
  formRef: any
  formData: PollFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: any
  onSubmit?: (newValues: PollFormValues) => void
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onPrevStep?: (newValues: PollFormValues) => void
  onNextStep?: (newValues: PollFormValues) => void
  closeWizard: () => void
}

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

interface PollWizardProps {
  title: string
  closeWizard: () => void
  initialValues?: Omit<Poll, 'id' | 'status'> & {
    id?: string
    status?: PublicationStatus
  }
  selection: Record<number, Element>
  resetSelection: () => void
  editMode: boolean
  duplicationMode: boolean
}

function PollWizard({
  title,
  closeWizard,
  initialValues,
  selection,
  resetSelection,
  editMode,
  duplicationMode,
}: PollWizardProps) {
  const t = useTranslations()

  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState<boolean[]>(
    Array(3).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<PollFormValues>>(null)

  const nameValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.activityWizard.activityName')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.activityWizard.activityDisplayName')),
    description: yup.string(),
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
                  .oneOf(acceptedTypes, t('manage.activityWizard.pollTypes')),
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
  }

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.activityWizard.pollInformation'),
      completed: stepValidity[0],
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.activityWizard.pollDescription'),
      completed: stepValidity[1],
    },
    {
      title: t('shared.generic.questions'),
      tooltip: t('manage.activityWizard.pollContent'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[2],
    },
  ]

  const [formData, setFormData] = useState<PollFormValues>({
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
                'options' in instance.elementData
                  ? (instance.elementData.options.hasSampleSolution ?? false)
                  : true,
              existingInstanceId: instance.id,
              duplicateInstance: duplicationMode,
            }
          }),
        }))
      : formDefaultValues.stacks,
  })

  const [createPoll, { data: creationData }] = useMutation(CreatePollDocument)
  const [editPoll, { data: editingData }] = useMutation(EditPollDocument)
  const handleSubmit = useCallback(
    async (values: PollFormValues) => {
      submitPollForm({
        id: initialValues?.id,
        values,
        editMode,
        createPoll,
        editPoll,
        setIsWizardCompleted,
        onError: () =>
          toast({
            type: 'error',
            message: (
              <div>
                <div>
                  {editMode
                    ? t('manage.activityWizard.pollEditingFailed')
                    : t('manage.activityWizard.pollCreationFailed')}
                </div>
                <div>{t('manage.activityWizard.considerFormErrors')}</div>
              </div>
            ),
            options: { duration: 6000 },
          }),
      })
    },
    [createPoll, editMode, editPoll, initialValues?.id]
  )

  const activityId = creationData?.createPoll?.id ?? editingData?.editPoll?.id

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
                ? t.rich('manage.activityWizard.pollUpdated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })
                : t.rich('manage.activityWizard.pollCreated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })}
            </div>
          )}
          name={formData.name}
          editMode={editMode}
          previewElementHref={`${process.env.NEXT_PUBLIC_PWA_URL}/polls/${activityId}`}
          viewElementHref="/activities"
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
        <PollInformationStep
          key="poll-information-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={nameValidationSchema}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<PollFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          closeWizard={closeWizard}
        />,
        <PollDescriptionStep
          key="poll-description-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={descriptionValidationSchema}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<PollFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<PollFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizard}
        />,
        <StackCreationStep
          key="poll-stack-step"
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
          onPrevStep={(newValues: Partial<PollFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          onSubmit={(newValues: PollFormValues) =>
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

export default PollWizard
