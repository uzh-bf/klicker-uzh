import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FieldArray, Form, Formik } from 'formik'
import AddStackButton from '../AddStackButton'
import CreationFormValidator from '../CreationFormValidator'
import WizardNavigation from '../WizardNavigation'
import LiveQuizCreationBlock from './LiveQuizCreationBlock'
import { LiveQuizWizardStepProps } from './LiveQuizWizard'

interface LiveQuizQuestionsStepProps extends LiveQuizWizardStepProps {
  selection: Record<number, Element>
  resetSelection: () => void
}

// TODO: update accepted types in live quiz to include flashcards and content elements
const acceptedTypes = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
  // ElementType.Flashcard,
  // ElementType.Content,
  ElementType.Selection,
]

function LiveQuizQuestionsStep({
  editMode,
  formRef,
  formData,
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
  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onSubmit!}
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
              <FieldArray name="blocks">
                {({ push, remove, move, replace }) => (
                  <div className="flex w-fit flex-row gap-4 overflow-x-auto">
                    {values.blocks.map((block, index) => (
                      <LiveQuizCreationBlock
                        key={`stack-${index}-${block.elements.map((e) => e.id).join('-')}`}
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
