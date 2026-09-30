import { faCrown, faGears } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getAuthorableAdaptivePresets } from '@klicker-uzh/adaptive-manage-ui/source/components/activities/creation/practiceQuiz/adaptivePracticeQuizForm.ts'
import {
  AdaptivePracticeQuizPreset,
  ElementOrderType,
  PracticeQuizMode,
} from '@klicker-uzh/graphql/dist/ops'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  FormikNumberField,
  FormikSelectField,
  FormikSwitchField,
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
import type { PracticeQuizWizardStepProps } from './PracticeQuizWizard'

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
  adaptiveCourses,
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
  const adaptiveGroupedCourses = useGamifiedCourseGrouping({
    gamifiedCourses: (adaptiveCourses ?? []).filter(
      ({ isGamified, isAssessmentEnabled }) =>
        isGamified && !isAssessmentEnabled
    ),
    nonGamifiedCourses: (adaptiveCourses ?? []).filter(
      ({ isGamified, isAssessmentEnabled }) =>
        !isGamified && !isAssessmentEnabled
    ),
    assessmentCourses: (adaptiveCourses ?? []).filter(
      ({ isAssessmentEnabled }) => isAssessmentEnabled
    ),
  })

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onNextStep!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting, setTouched, setValues }) => {
        return (
          <Form className="h-full min-h-0 w-full">
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
            <div className="flex h-full min-h-0 w-full flex-col justify-between gap-1">
              {values.mode === PracticeQuizMode.Standard ? (
                <div className="flex flex-col justify-center gap-4 md:flex-row">
                  <div
                    className={twMerge(
                      'border-border w-full rounded-md border border-solid p-2 shadow-md md:w-72',
                      courseGamified && 'border-orange-400'
                    )}
                  >
                    <div className="flex flex-row items-center justify-center gap-2">
                      <FontAwesomeIcon
                        icon={faCrown}
                        className="text-orange-400"
                      />
                      <div className="text-lg font-bold">
                        {t('shared.generic.gamification')}
                      </div>
                    </div>
                    <FormikSelectField
                      required
                      name="courseId"
                      label={t('shared.generic.course')}
                      tooltip={t(
                        'manage.activityWizard.practiceQuizSelectCourse'
                      )}
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
                        tooltip={t(
                          'manage.activityWizard.practiceQuizRepetition'
                        )}
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
                            label: t(
                              `manage.activityWizard.practiceQuiz${order}`
                            ),
                            data: {
                              cy: `select-order-${t(
                                `manage.activityWizard.practiceQuiz${order}`
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
                </div>
              ) : (
                <div
                  className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto pb-2 md:flex-row md:items-start md:justify-center"
                  data-cy="adaptive-practice-quiz-settings"
                >
                  <section className="border-border h-max w-full rounded-md border border-solid p-2 shadow-md md:w-72">
                    <div className="text-center text-lg font-bold">
                      {t('shared.generic.course')}
                    </div>
                    <FormikSelectField
                      required
                      name="courseId"
                      label={t('shared.generic.course')}
                      tooltip={t(
                        'manage.activityWizard.practiceQuizSelectCourse'
                      )}
                      placeholder={t('manage.activityWizard.selectCourse')}
                      groups={adaptiveGroupedCourses}
                      data={{ cy: 'select-course' }}
                      className={{
                        root: 'w-full',
                        tooltip: 'z-20',
                        select: { root: 'w-full', trigger: 'w-full' },
                      }}
                    />
                    {typeof values.courseId === 'undefined' ? (
                      <UserNotification
                        message={t(
                          'manage.activityWizard.practiceQuizMissingCourse'
                        )}
                        className={{ root: 'mt-2' }}
                        type="warning"
                      />
                    ) : null}
                    {adaptiveCourses?.length === 0 ? (
                      <UserNotification
                        type="warning"
                        message={t(
                          'manage.activityWizard.adaptive.mode.rolloutUnavailable'
                        )}
                        className={{ root: 'mt-2' }}
                        data={{ cy: 'adaptive-course-rollout-unavailable' }}
                      />
                    ) : null}
                    <UserNotification
                      type="info"
                      message={t(
                        'manage.activityWizard.adaptive.settings.noPoints'
                      )}
                      className={{ root: 'mt-3' }}
                    />
                  </section>

                  <section className="border-border h-max w-full rounded-md border border-solid p-2 shadow-md md:w-72">
                    <div className="flex flex-row items-center justify-center gap-2">
                      <FontAwesomeIcon icon={faGears} />
                      <div className="text-lg font-bold">
                        {t('shared.generic.settings')}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <FormikSelectField
                        required
                        name="adaptiveConfig.preset"
                        label={t(
                          'manage.activityWizard.adaptive.settings.preset'
                        )}
                        items={getAuthorableAdaptivePresets(
                          values.adaptiveConfig.preset
                        ).map((preset) => ({
                          value: preset,
                          label: t(
                            preset === AdaptivePracticeQuizPreset.Placement
                              ? 'manage.activityWizard.adaptive.preset.PLACEMENT_UNAVAILABLE'
                              : `manage.activityWizard.adaptive.preset.${preset}`
                          ),
                          disabled:
                            preset === AdaptivePracticeQuizPreset.Placement,
                          data: {
                            cy: `adaptive-preset-${preset.toLowerCase()}`,
                          },
                        }))}
                        data={{ cy: 'adaptive-preset' }}
                        className={{
                          root: 'w-full',
                          select: { root: 'w-full', trigger: 'w-full' },
                        }}
                      />
                      <FormikSwitchField
                        name="adaptiveConfig.showTimer"
                        label={t(
                          'manage.activityWizard.adaptive.settings.showTimer'
                        )}
                        data={{ cy: 'adaptive-show-timer' }}
                      />
                    </div>

                    {values.adaptiveConfig.preset ===
                    AdaptivePracticeQuizPreset.Research ? (
                      <UserNotification
                        type="warning"
                        message={t(
                          'manage.activityWizard.adaptive.research.nonClassifying'
                        )}
                        className={{ root: 'mt-3' }}
                        data={{ cy: 'adaptive-research-non-classifying' }}
                      />
                    ) : null}
                  </section>
                </div>
              )}
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
        )
      }}
    </Formik>
  )
}

export default PracticeQuizSettingsStep
