import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faCrown, faGears } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementOrderType } from '@klicker-uzh/graphql/dist/ops'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  FormikDateField,
  FormikNumberField,
  FormikSelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CourseSelectionMonitor from '../CourseSelectMonitor'
import CreationFormValidator from '../CreationFormValidator'
import MultiplierSelector from '../MultiplierSelector'
import WizardNavigation from '../WizardNavigation'
import { PracticeQuizWizardStepProps } from './PracticeQuizWizard'

function PracticeQuizSettingsStep({
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
}: PracticeQuizWizardStepProps) {
  const t = useTranslations()
  const [courseGamified, setCourseGamified] = useState(false)
  const groupedCourses = useGamifiedCourseGrouping({
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
      {({ values, isValid, isSubmitting, setTouched }) => (
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <CourseSelectionMonitor
            values={values}
            gamifiedCourses={gamifiedCourses}
            setCourseGamified={setCourseGamified}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="flex flex-col justify-center gap-4 md:flex-row">
              <div
                className={twMerge(
                  'border-uzh-grey-40 w-full rounded-md border border-solid p-2 shadow-md md:w-72',
                  courseGamified && 'border-orange-400'
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
                  tooltip={t('manage.sessionForms.practiceQuizSelectCourse')}
                  placeholder={t('manage.sessionForms.selectCourse')}
                  groups={groupedCourses}
                  data={{ cy: 'select-course' }}
                  className={{ tooltip: 'z-20' }}
                />

                {typeof values.courseId === 'undefined' ? (
                  <UserNotification
                    message={t('manage.sessionForms.practiceQuizMissingCourse')}
                    className={{ root: 'mt-2' }}
                    type="warning"
                  />
                ) : courseGamified ? (
                  <MultiplierSelector />
                ) : (
                  <UserNotification
                    message={t(
                      'manage.sessionForms.practiceQuizCourseNotGamified'
                    )}
                    className={{ root: 'mt-2' }}
                    type="info"
                  />
                )}
              </div>
              <div className="border-uzh-grey-40 w-full rounded-md border border-solid p-2 shadow-md md:w-72">
                <div className="flex flex-row items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faGears} />
                  <div className="text-lg font-bold">
                    {t('shared.generic.settings')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <FormikNumberField
                    name="resetTimeDays"
                    label={t('shared.generic.repetitionInterval')}
                    tooltip={t('manage.sessionForms.practiceQuizRepetition')}
                    className={{
                      root: 'w-full',
                      field: 'w-full',
                      tooltip: 'z-20',
                    }}
                    required
                    hideError={true}
                    data={{ cy: 'insert-reset-time-days' }}
                  />
                  <FormikSelectField
                    label={t('shared.generic.order')}
                    tooltip={t('manage.sessionForms.practiceQuizOrder')}
                    name="order"
                    placeholder={t(
                      'manage.sessionForms.practiceQuizSelectOrder'
                    )}
                    items={Object.values(ElementOrderType).map((order) => {
                      return {
                        value: order,
                        label: t(`manage.sessionForms.practiceQuiz${order}`),
                        data: {
                          cy: `select-order-${t(
                            `manage.sessionForms.practiceQuiz${order}`
                          )}`,
                        },
                      }
                    })}
                    required
                    data={{ cy: 'select-order' }}
                    className={{
                      root: 'w-full',
                      tooltip: 'z-20',
                    }}
                  />
                </div>
              </div>
              <div className="border-uzh-grey-40 w-full rounded-md border border-solid p-2 shadow-md md:w-72">
                <div className="flex flex-row items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faClock} />
                  <div className="text-lg font-bold">
                    {t('manage.sessionForms.practiceQuizAvailabilityOptional')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="mt-1 text-sm">
                    {t('manage.sessionForms.practiceQuizAvailableFrom')}
                  </div>
                  <FormikDateField
                    label={t('shared.generic.availableFrom')}
                    name="availableFrom"
                    className={{
                      root: 'w-full',
                      field: 'w-full',
                      tooltip: 'z-20',
                    }}
                    data={{ cy: 'select-available-from' }}
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

export default PracticeQuizSettingsStep
