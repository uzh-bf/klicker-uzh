import { useQuery } from '@apollo/client'
import {
  Element,
  ElementType,
  GetOutdatedElementInstancesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { FieldArray, Form, Formik } from 'formik'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import AddStackButton from './AddStackButton'
import CreationFormValidator from './CreationFormValidator'
import InstanceUpdateOption from './InstanceUpdateOption'
import StackBlockCreation from './StackBlockCreation'
import { ElementStackFormValues } from './WizardLayout'
import WizardNavigation from './WizardNavigation'
import { MicroLearningWizardStepProps } from './microLearning/MicroLearningWizard'
import { PracticeQuizWizardStepProps } from './practiceQuiz/PracticeQuizWizard'

interface PracticeQuizStackCreationStepProps
  extends PracticeQuizWizardStepProps {
  acceptedTypes: ElementType[]
  selection: Record<number, Element>
  resetSelection: () => void
}

interface MicroLearningStackCreationStepProps
  extends MicroLearningWizardStepProps {
  acceptedTypes: ElementType[]
  selection: Record<number, Element>
  resetSelection: () => void
}

function StackCreationStep({
  acceptedTypes,
  selection,
  resetSelection,
  editMode,
  formRef,
  formData,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  setStepValidity,
  onPrevStep,
  onSubmit,
  closeWizard,
}: MicroLearningStackCreationStepProps | PracticeQuizStackCreationStepProps) {
  // get all instances of elements alongside with the included element version
  const instanceVersionMap = useMemo(
    () =>
      formData.stacks.reduce<number[]>((acc, stack) => {
        stack.elements
          .filter((instance) => instance.existingInstanceId !== null)
          .forEach((instance) => {
            acc.push(instance.existingInstanceId!)
          })
        return acc
      }, []),
    [formData.stacks]
  )

  // query if any invalid element versions are used
  const { data, loading, refetch } = useQuery(
    GetOutdatedElementInstancesDocument,
    {
      variables: { instanceIds: instanceVersionMap },
      skip: instanceVersionMap.length === 0 || activeStep !== 3,
      fetchPolicy: 'network-only',
    }
  )
  const outdatedInstances = data?.getOutdatedElementInstances ?? []
  const showNotification = outdatedInstances.length > 0

  return (
    <Formik
      validateOnMount
      initialValues={formData as any} // FIXME: Types are defined correctly, but typescript inference does not work
      onSubmit={onSubmit! as any} // FIXME: Types are defined correctly, but typescript inference does not work
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, setValues, isValid, isSubmitting, errors }) => (
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            {showNotification && (
              <InstanceUpdateOption
                values={values}
                loading={loading}
                outdatedInstances={outdatedInstances}
                setValues={setValues}
                refetch={refetch}
              />
            )}
            <div className="mt-1 md:mt-0 md:overflow-x-auto">
              <FieldArray name="stacks">
                {({ push, remove, move, replace }) => (
                  <div
                    className={twMerge(
                      'flex w-fit flex-row gap-4 overflow-x-auto',
                      showNotification && 'h-40'
                    )}
                  >
                    {values.stacks.map(
                      (stack: ElementStackFormValues, index: number) => (
                        <StackBlockCreation
                          key={stack.clientId}
                          highlightFTNoSL
                          stackIx={index}
                          stack={stack}
                          numOfStacks={values.stacks.length}
                          acceptedTypes={acceptedTypes}
                          remove={remove}
                          move={move}
                          replace={replace}
                          selection={selection}
                          resetSelection={resetSelection}
                          error={errors.stacks as any}
                          outdatedInstances={outdatedInstances}
                          refetchOutdatedInstances={refetch}
                        />
                      )
                    )}
                    <AddStackButton
                      type="stack"
                      push={push}
                      selection={selection}
                      resetSelection={resetSelection}
                      acceptedTypes={acceptedTypes}
                    />
                  </div>
                )}
              </FieldArray>
            </div>
            <WizardNavigation
              editMode={editMode}
              isSubmitting={isSubmitting}
              stepValidity={stepValidity}
              activeStep={activeStep}
              lastStep={activeStep === stepValidity.length - 1}
              continueDisabled={continueDisabled}
              onPrevStep={() => onPrevStep!(values)}
              onCloseWizard={closeWizard}
            />
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default StackCreationStep
