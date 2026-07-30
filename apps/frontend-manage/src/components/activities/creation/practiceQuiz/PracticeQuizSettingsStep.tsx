import {
  faChevronDown,
  faChevronUp,
  faCrown,
  faGears,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveLevelMappingRule,
  AdaptivePracticeQuizPreset,
  ElementOrderType,
  PracticeQuizMode,
} from '@klicker-uzh/graphql/dist/ops'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  Button,
  FormikNumberField,
  FormikSelectField,
  FormikSwitchField,
  ShadcnCollapsible,
  ShadcnCollapsibleContent,
  ShadcnCollapsibleTrigger,
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
import { getAdaptivePracticeQuizEffectiveSettings } from './adaptivePracticeQuizForm'

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
  const [advancedOpen, setAdvancedOpen] = useState(false)
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
        const effectiveAdaptiveSettings =
          getAdaptivePracticeQuizEffectiveSettings(values.adaptiveConfig)

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
                  className="grid min-h-0 flex-1 gap-4 overflow-y-auto pb-2 md:grid-cols-[18rem_minmax(0,1fr)]"
                  data-cy="adaptive-practice-quiz-settings"
                >
                  <section className="border-border h-max rounded-md border border-solid p-3">
                    <div className="mb-2 text-base font-bold">
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
                      className={{ root: 'w-full', tooltip: 'z-20' }}
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

                  <section className="min-w-0">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <FormikSelectField
                        required
                        name="adaptiveConfig.preset"
                        label={t(
                          'manage.activityWizard.adaptive.settings.preset'
                        )}
                        items={Object.values(AdaptivePracticeQuizPreset).map(
                          (preset) => ({
                            value: preset,
                            label: t(
                              `manage.activityWizard.adaptive.preset.${preset}`
                            ),
                            data: {
                              cy: `adaptive-preset-${preset.toLowerCase()}`,
                            },
                          })
                        )}
                        data={{ cy: 'adaptive-preset' }}
                        className={{ root: 'w-full' }}
                      />
                      <FormikNumberField
                        required
                        name="adaptiveConfig.totalQuestionCap"
                        label={t(
                          'manage.activityWizard.adaptive.settings.totalQuestionCap'
                        )}
                        min={1}
                        max={1000}
                        precision={0}
                        data={{ cy: 'adaptive-total-question-cap' }}
                      />
                      <div className="flex items-end pb-1">
                        <FormikSwitchField
                          name="adaptiveConfig.showTimer"
                          label={t(
                            'manage.activityWizard.adaptive.settings.showTimer'
                          )}
                          data={{ cy: 'adaptive-show-timer' }}
                        />
                      </div>
                    </div>

                    <div className="border-uzh-grey-80 mt-4 border-y py-3 text-sm">
                      <SettingsSummary
                        label={t(
                          'manage.activityWizard.adaptive.settings.attemptPolicy'
                        )}
                        value={t(
                          `manage.activityWizard.adaptive.attemptPolicy.${effectiveAdaptiveSettings.attemptSelectionPolicy}`
                        )}
                      />
                    </div>

                    <ShadcnCollapsible
                      open={advancedOpen}
                      onOpenChange={setAdvancedOpen}
                      className="mt-3"
                    >
                      <ShadcnCollapsibleTrigger asChild>
                        <Button
                          type="button"
                          basic
                          data={{ cy: 'adaptive-advanced-settings-toggle' }}
                          className={{ root: 'h-8 px-1' }}
                        >
                          <Button.Icon
                            icon={advancedOpen ? faChevronUp : faChevronDown}
                          />
                          <Button.Label>
                            {t(
                              'manage.activityWizard.adaptive.settings.advanced'
                            )}
                          </Button.Label>
                        </Button>
                      </ShadcnCollapsibleTrigger>
                      <ShadcnCollapsibleContent className="border-uzh-grey-80 mt-2 border-t pt-3">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <FormikNumberField
                            name="adaptiveConfig.perLeafQuestionCap"
                            label={t(
                              'manage.activityWizard.adaptive.settings.perLeafQuestionCap'
                            )}
                            min={1}
                            max={1000}
                            precision={0}
                            data={{ cy: 'adaptive-per-leaf-question-cap' }}
                          />
                          <FormikNumberField
                            required
                            name="adaptiveConfig.minQuestionsPerLeaf"
                            label={t(
                              'manage.activityWizard.adaptive.settings.minQuestionsPerLeaf'
                            )}
                            min={1}
                            max={1000}
                            precision={0}
                            data={{ cy: 'adaptive-min-questions-per-leaf' }}
                          />
                          <FormikNumberField
                            required
                            name="adaptiveConfig.classificationZ"
                            label={t(
                              'manage.activityWizard.adaptive.settings.classificationZ'
                            )}
                            min={0.01}
                            max={5}
                            precision={2}
                            data={{ cy: 'adaptive-classification-z' }}
                          />
                        </div>

                        {values.adaptiveConfig.preset ===
                        AdaptivePracticeQuizPreset.Research ? (
                          <div
                            className="border-uzh-grey-80 mt-4 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3"
                            data-cy="adaptive-research-settings"
                          >
                            <FormikSelectField
                              name="adaptiveConfig.levelMappingRule"
                              label={t(
                                'manage.activityWizard.adaptive.settings.levelMappingRule'
                              )}
                              items={Object.values(
                                AdaptiveLevelMappingRule
                              ).map((rule) => ({
                                value: rule,
                                label: t(
                                  `manage.activityWizard.adaptive.levelMapping.${rule}`
                                ),
                              }))}
                              data={{ cy: 'adaptive-level-mapping-rule' }}
                              className={{ root: 'w-full' }}
                            />
                            <FormikSelectField
                              name="adaptiveConfig.attemptSelectionPolicy"
                              label={t(
                                'manage.activityWizard.adaptive.settings.attemptPolicy'
                              )}
                              items={Object.values(
                                AdaptiveAttemptSelectionPolicy
                              ).map((policy) => ({
                                value: policy,
                                label: t(
                                  `manage.activityWizard.adaptive.attemptPolicy.${policy}`
                                ),
                              }))}
                              data={{ cy: 'adaptive-attempt-policy' }}
                              className={{ root: 'w-full' }}
                            />
                            <FormikNumberField
                              required
                              name="adaptiveConfig.topInformationRatio"
                              label={t(
                                'manage.activityWizard.adaptive.settings.topInformationRatio'
                              )}
                              min={0.01}
                              max={1}
                              precision={2}
                              data={{ cy: 'adaptive-top-information-ratio' }}
                            />
                            <FormikNumberField
                              name="adaptiveConfig.defaultDiscrimination"
                              label={t(
                                'manage.activityWizard.adaptive.settings.defaultDiscrimination'
                              )}
                              min={0.01}
                              max={10}
                              precision={2}
                              data={{ cy: 'adaptive-default-discrimination' }}
                            />
                          </div>
                        ) : null}
                      </ShadcnCollapsibleContent>
                    </ShadcnCollapsible>
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

function SettingsSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-uzh-grey-100">{label}</div>
      <div className="truncate font-bold" title={value}>
        {value}
      </div>
    </div>
  )
}

export default PracticeQuizSettingsStep
