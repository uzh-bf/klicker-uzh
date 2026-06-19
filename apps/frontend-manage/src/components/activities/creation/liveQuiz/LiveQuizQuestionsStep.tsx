import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FieldArray, Form, Formik } from 'formik'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import AddStackButton from '../AddStackButton'
import CreationFormValidator from '../CreationFormValidator'
import InstanceUpdateOption from '../InstanceUpdateOption'
import WizardNavigation from '../WizardNavigation'
import { useOutdatedElementInstances } from '../useOutdatedElementInstances'
import LiveQuizCreationBlock from './LiveQuizCreationBlock'
import { LiveQuizWizardStepProps } from './LiveQuizWizard'

interface LiveQuizQuestionsStepProps extends LiveQuizWizardStepProps {
  acceptedTypes: ElementType[]
  selection: Record<number, Element>
  resetSelection: () => void
}

function LiveQuizQuestionsStep({
  editMode,
  formRef,
  formData,
  acceptedTypes,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  setStepValidity,
  onSubmit,
  onPrevStep,
  closeWizard,
  selection,
  resetSelection,
}: LiveQuizQuestionsStepProps) {
  // get all instances of elements alongside with the included element version
  const instanceVersionMap = useMemo(
    () =>
      formData.blocks.reduce<number[]>((acc, block) => {
        block.elements
          .filter((instance) => instance.existingInstanceId !== null)
          .forEach((instance) => {
            acc.push(instance.existingInstanceId!)
          })
        return acc
      }, []),
    [formData.blocks]
  )

  // query if any invalid element versions are used
  const {
    loading,
    outdatedInstances,
    refetch: refetchOutdatedInstances,
  } = useOutdatedElementInstances({
    enabled: activeStep === 3,
    instanceIds: instanceVersionMap,
  })
  const showNotification = outdatedInstances.length > 0

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onSubmit!}
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
                refetch={refetchOutdatedInstances}
              />
            )}
            <div className="mt-1 md:mt-0 md:overflow-x-auto">
              <FieldArray name="blocks">
                {({ push, remove, move, replace }) => (
                  <div
                    className={twMerge(
                      'flex w-fit flex-row gap-4 overflow-x-auto',
                      showNotification && 'h-40'
                    )}
                  >
                    {values.blocks.map((block, index) => (
                      <LiveQuizCreationBlock
                        key={`stack-${index}`}
                        blockIx={index}
                        block={block}
                        numOfBlocks={values.blocks.length}
                        acceptedTypes={acceptedTypes}
                        remove={remove}
                        move={move}
                        replace={replace}
                        selection={selection}
                        resetSelection={resetSelection}
                        error={errors.blocks as any}
                        outdatedInstances={outdatedInstances}
                        refetchOutdatedInstances={refetchOutdatedInstances}
                      />
                    ))}
                    <AddStackButton
                      type="block"
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

export default LiveQuizQuestionsStep
