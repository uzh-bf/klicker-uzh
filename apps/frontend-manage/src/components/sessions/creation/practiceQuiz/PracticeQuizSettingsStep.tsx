import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faCrown, faGears } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementOrderType } from '@klicker-uzh/graphql/dist/ops'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  NewFormikDateField,
  NewFormikNumberField,
  NewFormikSelectField,
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
        <Form className="w-full h-full">
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
          <div className="flex flex-col w-full h-full justify-between gap-1">
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <div
                className={twMerge(
                  'border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-72 shadow-md',
                  courseGamified && 'border-orange-400'
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
              <div className="border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-72 shadow-md">
                <div className="flex flex-row gap-2 items-center justify-center">
                  <FontAwesomeIcon icon={faGears} />
                  <div className="text-lg font-bold">
                    {t('shared.generic.settings')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <NewFormikNumberField
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
                  <NewFormikSelectField
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
              <div className="border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-72 shadow-md">
                <div className="flex flex-row gap-2 items-center justify-center">
                  <FontAwesomeIcon icon={faClock} />
                  <div className="text-lg font-bold">
                    {t('manage.sessionForms.practiceQuizAvailabilityOptional')}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-sm mt-1">
                    {t('manage.sessionForms.practiceQuizAvailableFrom')}
                  </div>
                  <NewFormikDateField
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
              onCloseWizard={closeWizard}
            />
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default PracticeQuizSettingsStep
