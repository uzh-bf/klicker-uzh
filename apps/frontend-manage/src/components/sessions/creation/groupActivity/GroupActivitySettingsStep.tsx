import { faClock, faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  FormikDateField,
  FormikSelectField,
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
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <DateChangeMonitor values={values} setTouched={setTouched} />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="flex flex-col justify-center gap-4 md:flex-row">
              <div
                className={twMerge(
                  'border-uzh-grey-40 w-full rounded-md border border-solid p-2 shadow-md md:w-72',
                  typeof values.courseId !== 'undefined' && 'border-orange-400'
                )}
              >
                <div className="flex flex-row items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
                  <div className="text-lg font-bold">
                    {t('shared.generic.gamification')}
                  </div>
                </div>
                <FormikSelectField
                  required
                  name="courseId"
                  label={t('shared.generic.course')}
                  tooltip={t('manage.sessionForms.groupActivityCourse')}
                  placeholder={t('manage.sessionForms.selectCourse')}
                  groups={groupedCourses}
                  data={{ cy: 'select-course' }}
                  className={{ tooltip: 'z-20' }}
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
              <div className="border-uzh-grey-40 w-full rounded-md border border-solid p-2 shadow-md md:w-72">
                <div className="flex flex-row items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faClock} />
                  <div className="text-lg font-bold">
                    {t('shared.generic.availability')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <FormikDateField
                    label={t('shared.generic.startDate')}
                    name="startDate"
                    tooltip={t('manage.sessionForms.groupActivityStartDate')}
                    required
                    className={{
                      root: 'w-full',
                      field: 'w-full',
                      tooltip: 'z-20',
                    }}
                    data={{ cy: 'select-start-date' }}
                  />
                  <FormikDateField
                    label={t('shared.generic.endDate')}
                    name="endDate"
                    tooltip={t('manage.sessionForms.groupActivityEndDate')}
                    required
                    className={{
                      root: 'w-full',
                      field: 'w-full',
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
