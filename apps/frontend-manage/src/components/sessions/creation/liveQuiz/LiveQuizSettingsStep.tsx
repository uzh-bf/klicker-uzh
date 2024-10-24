import { faCrown, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useLiveQuizCourseGrouping from '@lib/hooks/useLiveQuizCourseGrouping'
import {
  FormikSelectField,
  FormikSwitchField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import CreationFormValidator from '../CreationFormValidator'
import MultiplierSelector from '../MultiplierSelector'
import WizardNavigation from '../WizardNavigation'
import AdvancedLiveQuizSettings from './AdvancedLiveQuizSettings'
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
  onPrevStep,
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
        <Form className="h-full w-full">
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
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="flex flex-col justify-center gap-4 md:flex-row">
              <div
                className={twMerge(
                  'border-uzh-grey-40 w-full rounded-md border border-solid p-2 shadow-md md:w-64',
                  values.isGamificationEnabled && 'border-orange-400'
                )}
              >
                <div className="grid grid-cols-9">
                  <div className="col-span-7 col-start-2 flex flex-row items-center justify-center gap-2">
                    <FontAwesomeIcon
                      icon={faCrown}
                      className="text-orange-400"
                    />
                    <div className="text-lg font-bold">
                      {t('shared.generic.gamification')}
                    </div>
                  </div>
                  {values.isGamificationEnabled && (
                    <AdvancedLiveQuizSettings
                      maxBonusValue={String(values.maxBonusPoints)}
                      timeToZeroValue={String(values.timeToZeroBonus)}
                    />
                  )}
                </div>
                <FormikSelectField
                  name="courseId"
                  label={t('shared.generic.course')}
                  tooltip={t('manage.sessionForms.liveQuizDescCourse')}
                  placeholder={t('manage.sessionForms.liveQuizSelectCourse')}
                  groups={groupedCourses}
                  data={{ cy: 'select-course' }}
                  className={{ tooltip: 'z-20' }}
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
              <div className="border-uzh-grey-40 w-full rounded-md border border-solid p-2 shadow-md md:w-64">
                <div className="mb-4 flex flex-row items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faUsers} />
                  <div className="text-lg font-bold">
                    {t('shared.generic.settings')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <FormikSwitchField
                    required
                    name="isConfusionFeedbackEnabled"
                    label={t('shared.generic.feedbackChannel')}
                    tooltip={t('manage.sessionForms.liveQuizFeedbackChannel')}
                    data={{ cy: 'set-feedback-enabled' }}
                  />
                  <FormikSwitchField
                    required
                    name="isLiveQAEnabled"
                    label={t('shared.generic.liveQA')}
                    tooltip={t('manage.sessionForms.liveQuizLiveQA')}
                    data={{ cy: 'set-liveqa-enabled' }}
                  />
                  <FormikSwitchField
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
              onPrevStep={() => onPrevStep!(values)}
              onCloseWizard={closeWizard}
            />
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default LiveQuizSettingsStep
