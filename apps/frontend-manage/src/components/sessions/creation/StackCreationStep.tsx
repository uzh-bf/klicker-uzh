import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FieldArray, FieldArrayRenderProps, Form, Formik } from 'formik'
import AddStackButton from './AddStackButton'
import CreationFormValidator from './CreationFormValidator'
import { ElementStackFormValues } from './MultistepWizard'
import StackBlockCreation from './StackBlockCreation'
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
  onSubmit,
  closeWizard,
}: MicroLearningStackCreationStepProps | PracticeQuizStackCreationStepProps) {
  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onSubmit!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting, errors }) => (
        <Form className="w-full h-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex flex-col w-full h-full justify-between gap-1">
            <div className="mt-1 md:mt-0 md:overflow-x-auto">
              <FieldArray name="stacks">
                {({ push, remove, move, replace }: FieldArrayRenderProps) => (
                  <div className="flex flex-row gap-4 overflow-x-auto w-fit">
                    {values.stacks.map(
                      (stack: ElementStackFormValues, index: number) => (
                        <StackBlockCreation
                          key={`${index}-${stack.elementIds.join('')}`}
                          index={index}
                          stack={stack}
                          numOfStacks={values.stacks.length}
                          acceptedTypes={acceptedTypes}
                          remove={remove}
                          move={move}
                          replace={replace}
                          selection={selection}
                          resetSelection={resetSelection}
                          error={errors.stacks as any}
                        />
                      )
                    )}
                    <AddStackButton
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
              onCloseWizard={closeWizard}
            />
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default StackCreationStep
