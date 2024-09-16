import { Markdown } from '@klicker-uzh/markdown'
import { FormikTextField, H2, H3 } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import CreationFormValidator from './CreationFormValidator'
import EditorField from './EditorField'
import WizardNavigation from './WizardNavigation'
import { GroupActivityWizardStepProps } from './groupActivity/GroupActivityWizard'
import { LiveQuizWizardStepProps } from './liveQuiz/LiveSessionWizard'
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

interface LiveQuizDescriptionStepProps extends LiveQuizWizardStepProps {
  displayNameTooltip: string
  descriptionTooltip: string
  descriptionLabel?: string
  dataDisplayName?: { test?: string; cy?: string }
  dataDescription?: { test?: string; cy?: string }
  descriptionRequired?: boolean
}

interface GroupActivityDescriptionStepProps
  extends GroupActivityWizardStepProps {
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
  onPrevStep,
  closeWizard,
}:
  | MicroLearningDescriptionStepProps
  | PracticeQuizDescriptionStepProps
  | LiveQuizDescriptionStepProps
  | GroupActivityDescriptionStepProps) {
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
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="-mt-2 flex flex-row">
              <div className="w-3/5 flex-1 md:mr-6">
                <FormikTextField
                  required
                  autoComplete="off"
                  name="displayName"
                  label={t('manage.sessionForms.displayName')}
                  tooltip={displayNameTooltip}
                  className={{
                    root: 'mb-1 w-full md:w-1/2',
                    tooltip: 'z-20',
                    label: 'mt-0',
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
                  data={dataDescription}
                />
              </div>
              <div className="hidden w-2/5 flex-col gap-1 md:flex">
                <H2>{t('shared.generic.preview')}</H2>
                <div className="h-full w-full overflow-y-auto rounded-md border border-solid">
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
              onPrevStep={() => onPrevStep!(values)}
              onCloseWizard={closeWizard}
            />
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default DescriptionStep
