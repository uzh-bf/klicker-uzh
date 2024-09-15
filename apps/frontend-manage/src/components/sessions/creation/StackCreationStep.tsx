import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FieldArray, FieldArrayRenderProps, Form, Formik } from 'formik'
import AddStackButton from './AddStackButton'
import CreationFormValidator from './CreationFormValidator'
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
  return (
    <Formik
      validateOnMount
      initialValues={formData as any} // FIXME: Types are defined correctly, but typescript inference does not work
      onSubmit={onSubmit! as any} // FIXME: Types are defined correctly, but typescript inference does not work
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting, errors }) => (
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="mt-1 md:mt-0 md:overflow-x-auto">
              <FieldArray name="stacks">
                {({ push, remove, move, replace }: FieldArrayRenderProps) => (
                  <div className="flex w-fit flex-row gap-4 overflow-x-auto">
                    {values.stacks.map(
                      (stack: ElementStackFormValues, index: number) => (
                        <StackBlockCreation
                          key={`stack-${index}-${stack.elements.map((e) => e.id).join('-')}`}
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
                          highlightFTNoSL
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
