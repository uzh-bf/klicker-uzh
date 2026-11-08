import EscapeRoomSettingsFields from '@components/activities/creation/EscapeRoomSettingsFields'
import { faClock, faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  FormikDatetimePicker,
  FormikSelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import useGroupActivityCourseGrouping from '../../../../lib/hooks/useGroupActivityCourseGrouping'
import CourseChangeMonitor from '../CourseChangeMonitor'
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
  coursesWithGroups,
  assessmentCoursesWithGroups,
  coursesWithoutGroups,
  setStepValidity,
  onPrevStep,
  onNextStep,
  closeWizard,
}: GroupActivityWizardStepProps) {
  const t = useTranslations()
  const groupedCourses = useGroupActivityCourseGrouping({
    coursesWithGroups: coursesWithGroups ?? [],
    assessmentCoursesWithGroups: assessmentCoursesWithGroups ?? [],
    coursesWithoutGroups: coursesWithoutGroups ?? [],
  })

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onNextStep!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({
        values,
        isValid,
        isSubmitting,
        setTouched,
        setValues,
        setFieldValue,
      }) => (
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <DateChangeMonitor values={values} setTouched={setTouched} />
          <CourseChangeMonitor
            values={values}
            setTouched={setTouched}
            setValues={setValues}
            courses={coursesWithGroups ?? []}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="flex flex-col justify-center gap-4 md:flex-row">
              <div
                className={twMerge(
                  'border-border w-full rounded-md border border-solid p-2 shadow-md md:w-72',
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
                  tooltip={t('manage.activityWizard.groupActivityCourse')}
                  placeholder={t('manage.activityWizard.selectCourse')}
                  groups={groupedCourses}
                  data={{ cy: 'select-course' }}
                  className={{ tooltip: 'z-20' }}
                />

                {typeof values.courseId === 'undefined' ? (
                  <UserNotification
                    message={t(
                      'manage.activityWizard.groupActivityMissingCourse'
                    )}
                    className={{ root: 'mt-2' }}
                    type="warning"
                  />
                ) : (
                  <MultiplierSelector />
                )}
              </div>
              <div className="border-border w-full rounded-md border border-solid p-2 shadow-md md:w-72">
                <div className="flex flex-row items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faClock} />
                  <div
                    className="text-lg font-bold"
                    data-cy="availability-section-header"
                  >
                    {t('shared.generic.availability')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <FormikDatetimePicker
                    required
                    name="startDate"
                    label={t('shared.generic.startDate')}
                    tooltip={t('manage.activityWizard.groupActivityStartDate')}
                    granularity="minute"
                    className={{ tooltip: 'z-20' }}
                    dataTrigger={{ cy: 'select-start-date' }}
                    dataCalendar={{ cy: 'select-start-date-calendar' }}
                    dataPreviousMonth={{
                      cy: 'select-start-date-previous-month',
                    }}
                    dataNextMonth={{ cy: 'select-start-date-next-month' }}
                    dataHours={{ cy: 'select-start-date-hours' }}
                    dataMinutes={{ cy: 'select-start-date-minutes' }}
                  />
                  <FormikDatetimePicker
                    required
                    name="endDate"
                    label={t('shared.generic.endDate')}
                    tooltip={t('manage.activityWizard.groupActivityEndDate')}
                    granularity="minute"
                    className={{ tooltip: 'z-20' }}
                    dataTrigger={{ cy: 'select-end-date' }}
                    dataCalendar={{ cy: 'select-end-date-calendar' }}
                    dataPreviousMonth={{
                      cy: 'select-end-date-previous-month',
                    }}
                    dataNextMonth={{ cy: 'select-end-date-next-month' }}
                    dataHours={{ cy: 'select-end-date-hours' }}
                    dataMinutes={{ cy: 'select-end-date-minutes' }}
                  />
                  <EscapeRoomSettingsFields
                    isEscapeRoom={!!values.isEscapeRoom}
                    onToggle={(next) => setFieldValue('isEscapeRoom', next)}
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

export default GroupActivitySettingsStep
