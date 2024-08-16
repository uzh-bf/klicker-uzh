import { faCrown, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useLiveQuizCourseGrouping from '@lib/hooks/useLiveQuizCourseGrouping'
import {
  NewFormikSelectField,
  NewFormikSwitchField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import CreationFormValidator from '../CreationFormValidator'
import MultiplierSelector from '../MultiplierSelector'
import WizardNavigation from '../WizardNavigation'
import LiveQuizCourseMonitor from './LiveQuizCourseMonitor'
import { LiveQuizWizardStepProps } from './LiveSessionWizard'

function LiveQuizSettingsStep({
  editMode,
  formRef,
  formData,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  gamifiedCourses,
  nonGamifiedCourses,
  setStepValidity,
  onNextStep,
  closeWizard,
}: LiveQuizWizardStepProps) {
  const t = useTranslations()

  const groupedCourses = useLiveQuizCourseGrouping({
    gamifiedCourses: gamifiedCourses ?? [],
    nonGamifiedCourses: nonGamifiedCourses ?? [],
  })

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onNextStep!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting, setFieldValue }) => (
        <Form className="w-full h-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <LiveQuizCourseMonitor
            values={values}
            setFieldValue={setFieldValue}
            gamifiedCourses={gamifiedCourses ?? []}
            nonGamifiedCourses={nonGamifiedCourses ?? []}
          />
          <div className="flex flex-col w-full h-full justify-between gap-1">
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <div
                className={twMerge(
                  'border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-64 shadow-md',
                  values.isGamificationEnabled && 'border-orange-400'
                )}
              >
                <div className="flex flex-row gap-2 items-center justify-center">
                  <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
                  <div className="text-lg font-bold">
                    {t('shared.generic.gamification')}
                  </div>
                </div>
                <NewFormikSelectField
                  name="courseId"
                  label={t('shared.generic.course')}
                  tooltip={t('manage.sessionForms.liveQuizDescCourse')}
                  placeholder={t('manage.sessionForms.liveQuizSelectCourse')}
                  groups={groupedCourses}
                  data={{ cy: 'select-course' }}
                  className={{ tooltip: 'z-20', label: 'text-base mb-0.5' }}
                />
                {values.isGamificationEnabled ? (
                  <MultiplierSelector
                    disabled={!values.isGamificationEnabled}
                  />
                ) : (
                  <UserNotification
                    message={t(
                      'manage.sessionForms.liveQuizEnableGamification'
                    )}
                    className={{ root: 'mt-2' }}
                    type="info"
                  />
                )}
              </div>
              <div className="border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-64 shadow-md">
                <div className="flex flex-row gap-2 items-center justify-center mb-4">
                  <FontAwesomeIcon icon={faUsers} />
                  <div className="text-lg font-bold">
                    {t('shared.generic.settings')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <NewFormikSwitchField
                    required
                    name="isConfusionFeedbackEnabled"
                    label={t('shared.generic.feedbackChannel')}
                    tooltip={t('manage.sessionForms.liveQuizFeedbackChannel')}
                    data={{ cy: 'set-feedback-enabled' }}
                  />
                  <NewFormikSwitchField
                    required
                    name="isLiveQAEnabled"
                    label={t('shared.generic.liveQA')}
                    tooltip={t('manage.sessionForms.liveQuizLiveQA')}
                    data={{ cy: 'set-liveqa-enabled' }}
                  />
                  <NewFormikSwitchField
                    required
                    disabled={!values.isLiveQAEnabled}
                    name="isModerationEnabled"
                    label={t('shared.generic.moderation')}
                    tooltip={t('manage.sessionForms.liveQuizModeration')}
                    data={{ cy: 'set-liveqa-moderation' }}
                  />
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

export default LiveQuizSettingsStep
