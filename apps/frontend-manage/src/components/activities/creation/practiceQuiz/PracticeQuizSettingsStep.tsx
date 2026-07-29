import EscapeRoomSettingsFields from '@components/activities/creation/EscapeRoomSettingsFields'
import { faCrown, faGears } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementOrderType } from '@klicker-uzh/graphql/dist/ops'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  FormikNumberField,
  FormikSelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CourseSelectionMonitorPracticeQuiz from '../CourseSelectionMonitorPracticeQuiz'
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
  assessmentCourses,
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
    assessmentCourses: assessmentCourses ?? [],
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
          <CourseSelectionMonitorPracticeQuiz
            values={values}
            gamifiedCourses={gamifiedCourses}
            nonGamifiedCourses={nonGamifiedCourses}
            setCourseGamified={setCourseGamified}
            setTouched={setTouched}
            setValues={setValues}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="flex flex-col justify-center gap-4 md:flex-row">
              <div
                className={twMerge(
                  'border-border w-full rounded-md border border-solid p-2 shadow-md md:w-72',
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
                  tooltip={t('manage.activityWizard.practiceQuizSelectCourse')}
                  placeholder={t('manage.activityWizard.selectCourse')}
                  groups={groupedCourses}
                  data={{ cy: 'select-course' }}
                  className={{ tooltip: 'z-20' }}
                />

                {typeof values.courseId === 'undefined' ? (
                  <UserNotification
                    message={t(
                      'manage.activityWizard.practiceQuizMissingCourse'
                    )}
                    className={{ root: 'mt-2' }}
                    type="warning"
                  />
                ) : courseGamified ? (
                  <MultiplierSelector />
                ) : (
                  <UserNotification
                    message={t(
                      'manage.activityWizard.practiceQuizCourseNotGamified'
                    )}
                    className={{ root: 'mt-2' }}
                    type="info"
                  />
                )}
              </div>
              <div className="border-border w-full rounded-md border border-solid p-2 shadow-md md:w-72">
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
                    tooltip={t('manage.activityWizard.practiceQuizRepetition')}
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
                    tooltip={t('manage.activityWizard.practiceQuizOrder')}
                    name="order"
                    placeholder={t(
                      'manage.activityWizard.practiceQuizSelectOrder'
                    )}
                    items={Object.values(ElementOrderType).map((order) => {
                      return {
                        value: order,
                        label: t(`manage.activityWizard.practiceQuiz${order}`),
                        data: {
                          cy: `select-order-${t(
                            `manage.activityWizard.practiceQuiz${order}`
                          )}`,
                        },
                      }
                    })}
                    required
                    disabled={!!values.isEscapeRoom}
                    data={{ cy: 'select-order' }}
                    className={{
                      root: 'w-full',
                      tooltip: 'z-20',
                    }}
                  />
                  <EscapeRoomSettingsFields
                    isEscapeRoom={!!values.isEscapeRoom}
                    onToggle={(next) => {
                      setFieldValue('isEscapeRoom', next)
                      // practice-quiz ONLY: force sequential order when enabling
                      if (next)
                        setFieldValue('order', ElementOrderType.Sequential)
                    }}
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
