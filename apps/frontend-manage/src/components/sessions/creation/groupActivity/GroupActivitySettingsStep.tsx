import { faClock, faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  NewFormikDateField,
  NewFormikSelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import CreationFormValidator from '../CreationFormValidator'
import DateChangeMonitor from '../DateChangeMonitor'
import MultiplierSelector from '../MultiplierSelector'
import WizardNavigation from '../WizardNavigation'
import { GroupActivityWizardStepProps } from './GroupActivityWizard'

function GroupActivitySettingsStep({
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
}: GroupActivityWizardStepProps) {
  const t = useTranslations()
  const groupedCourses = useGamifiedCourseGrouping({
    gamifiedCourses: gamifiedCourses ?? [],
    nonGamifiedCourses:
      nonGamifiedCourses?.map((course) => {
        return { ...course, disabled: true }
      }) ?? [],
  })

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onNextStep!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting, setTouched }) => (
        <Form className="w-full h-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <DateChangeMonitor values={values} setTouched={setTouched} />
          <div className="flex flex-col w-full h-full justify-between gap-1">
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <div
                className={twMerge(
                  'border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-72 shadow-md',
                  typeof values.courseId !== 'undefined' && 'border-orange-400'
                )}
              >
                <div className="flex flex-row gap-2 items-center justify-center">
                  <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
                  <div className="text-lg font-bold">
                    {t('shared.generic.gamification')}
                  </div>
                </div>
                <NewFormikSelectField
                  required
                  name="courseId"
                  label={t('shared.generic.course')}
                  tooltip={t('manage.sessionForms.groupActivityCourse')}
                  placeholder={t('manage.sessionForms.selectCourse')}
                  groups={groupedCourses}
                  data={{ cy: 'select-course' }}
                  className={{ tooltip: 'z-20', label: 'text-base mb-0.5' }}
                />

                {typeof values.courseId === 'undefined' ? (
                  <UserNotification
                    message={t(
                      'manage.sessionForms.groupActivityMissingCourse'
                    )}
                    className={{ root: 'mt-2' }}
                    type="warning"
                  />
                ) : (
                  <MultiplierSelector />
                )}
              </div>
              <div className="border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-72 shadow-md">
                <div className="flex flex-row gap-2 items-center justify-center">
                  <FontAwesomeIcon icon={faClock} />
                  <div className="text-lg font-bold">
                    {t('shared.generic.availability')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <NewFormikDateField
                    label={t('shared.generic.startDate')}
                    name="startDate"
                    tooltip={t('manage.sessionForms.groupActivityStartDate')}
                    required
                    className={{
                      root: 'w-full',
                      field: 'w-full',
                      label: 'text-base mb-0.5',
                      tooltip: 'z-20',
                    }}
                    data={{ cy: 'select-start-date' }}
                  />
                  <NewFormikDateField
                    label={t('shared.generic.endDate')}
                    name="endDate"
                    tooltip={t('manage.sessionForms.groupActivityEndDate')}
                    required
                    className={{
                      root: 'w-full',
                      field: 'w-full',
                      label: 'text-base mb-0.5',
                      tooltip: 'z-20',
                    }}
                    data={{ cy: 'select-end-date' }}
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

export default GroupActivitySettingsStep
