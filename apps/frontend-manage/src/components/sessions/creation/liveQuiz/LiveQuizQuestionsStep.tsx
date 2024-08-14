import { Element } from '@klicker-uzh/graphql/dist/ops'
import { FieldArray, FieldArrayRenderProps, Form, Formik } from 'formik'
import CreationFormValidator from '../CreationFormValidator'
import { LiveQuizBlockFormValues } from '../WizardLayout'
import WizardNavigation from '../WizardNavigation'
import LiveQuizAddBlockButton from './LiveQuizAddBlockButton'
import LiveQuizCreationBlock from './LiveQuizCreationBlock'
import { LiveQuizWizardStepProps } from './LiveSessionWizard'

interface LiveQuizQuestionsStepProps extends LiveQuizWizardStepProps {
  selection: Record<number, Element>
  resetSelection: () => void
}

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
          <div className="flex flex-col w-full h-full justify-between gap-1">
            <div className="mt-1 md:mt-0 md:overflow-x-auto">
              <FieldArray name="blocks">
                {({ push, remove, move, replace }: FieldArrayRenderProps) => (
                  <div className="flex flex-row gap-4 overflow-x-auto w-fit">
                    {values.blocks.map(
                      (block: LiveQuizBlockFormValues, index: number) => (
                        <LiveQuizCreationBlock
                          key={`${index}-${block.questionIds.join('')}`}
                          index={index}
                          block={block}
                          numOfBlocks={values.blocks.length}
                          remove={remove}
                          move={move}
                          replace={replace}
                          selection={selection}
                          resetSelection={resetSelection}
                          error={errors.blocks as any}
                        />
                      )
                    )}
                    <LiveQuizAddBlockButton
                      push={push}
                      selection={selection}
                      resetSelection={resetSelection}
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

export default LiveQuizQuestionsStep
