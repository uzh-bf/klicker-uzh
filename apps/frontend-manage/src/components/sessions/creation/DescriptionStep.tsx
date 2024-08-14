import { Markdown } from '@klicker-uzh/markdown'
import { H2, H3, NewFormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import CreationFormValidator from './CreationFormValidator'
import EditorField from './EditorField'
import WizardNavigation from './WizardNavigation'
import { MicroLearningWizardStepProps } from './microLearning/MicroLearningWizard'
import { PracticeQuizWizardStepProps } from './practiceQuiz/PracticeQuizWizard'

interface MicroLearningDescriptionStepProps
  extends MicroLearningWizardStepProps {
  displayNameTooltip: string
  descriptionTooltip: string
  descriptionLabel?: string
  dataDisplayName?: { test?: string; cy?: string }
  dataDescription?: { test?: string; cy?: string }
  descriptionRequired?: boolean
}

interface PracticeQuizDescriptionStepProps extends PracticeQuizWizardStepProps {
  displayNameTooltip: string
  descriptionTooltip: string
  descriptionLabel?: string
  dataDisplayName?: { test?: string; cy?: string }
  dataDescription?: { test?: string; cy?: string }
  descriptionRequired?: boolean
}

function DescriptionStep({
  displayNameTooltip,
  descriptionTooltip,
  descriptionLabel,
  dataDisplayName,
  dataDescription,
  descriptionRequired = false,
  editMode,
  formRef,
  formData,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  setStepValidity,
  onNextStep,
  closeWizard,
}: MicroLearningDescriptionStepProps | PracticeQuizDescriptionStepProps) {
  const t = useTranslations()

  return (
    <Formik
      validateOnMount
      initialValues={formData as any} // FIXME: types are defined correctly, but typescript does not infer them correctly
      onSubmit={onNextStep! as any} // FIXME: types are defined correctly, but typescript does not infer them correctly
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting }) => (
        <Form className="w-full h-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex flex-col w-full h-full justify-between gap-1">
            <div className="flex flex-row -mt-2">
              <div className="flex-1 w-3/5 md:mr-6">
                <NewFormikTextField
                  required
                  autoComplete="off"
                  name="displayName"
                  label={t('manage.sessionForms.displayName')}
                  tooltip={displayNameTooltip}
                  className={{
                    root: 'mb-1 w-full md:w-1/2',
                    tooltip: 'z-20',
                    label: 'text-base mb-0.5 mt-0',
                  }}
                  data={dataDisplayName}
                />
                <EditorField
                  // key={fieldName.value}
                  required={descriptionRequired}
                  label={descriptionLabel ?? t('shared.generic.description')}
                  tooltip={descriptionTooltip}
                  fieldName="description"
                  showToolbarOnFocus={false}
                  className={{ label: 'text-base mb-0.5' }}
                  data={dataDescription}
                />
              </div>
              <div className="hidden md:flex flex-col gap-1 w-2/5">
                <H2>{t('shared.generic.preview')}</H2>
                <div className="h-full w-full border border-solid rounded-md overflow-y-auto">
                  <div className="p-4">
                    <H3>{values.displayName}</H3>
                    <Markdown
                      content={values.description}
                      className={{ root: 'h-24' }}
                    />
                  </div>
                </div>
              </div>
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

export default DescriptionStep
