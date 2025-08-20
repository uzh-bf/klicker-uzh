import { useQuery } from '@apollo/client'
import {
  faCheck,
  faCrown,
  faGears,
  faUsers,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  LQ_DEFAULT_CORRECT_POINTS,
  LQ_DEFAULT_POINTS,
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import useLiveQuizCourseGrouping from '@lib/hooks/useLiveQuizCourseGrouping'
import {
  Checkbox,
  FormikSwitchField,
  SelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CreationFormValidator from '../CreationFormValidator'
import MultiplierSelector from '../MultiplierSelector'
import WizardNavigation from '../WizardNavigation'
import AdvancedLiveQuizSettings from './AdvancedLiveQuizSettings'
import { LiveQuizWizardStepProps } from './LiveQuizWizard'

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
  assessmentCourses,
  setStepValidity,
  onNextStep,
  onPrevStep,
  closeWizard,
}: LiveQuizWizardStepProps) {
  const t = useTranslations()
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  const [customizedGradingModal, setCustomizedGradingModal] = useState(false)
  const groupedCourses = useLiveQuizCourseGrouping({
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
      {({ values, errors, isValid, isSubmitting, setFieldValue }) => {
        const selectedCourse = [
          ...(gamifiedCourses ?? []),
          ...(nonGamifiedCourses ?? []),
          ...(assessmentCourses ?? []),
        ].find((course) => course.value === values.courseId)
        const customizedGradingEnabled =
          parseInt(String(values.defaultPoints)) !== LQ_DEFAULT_POINTS ||
          parseInt(String(values.defaultCorrectPoints)) !==
            LQ_DEFAULT_CORRECT_POINTS ||
          parseInt(String(values.maxBonusPoints)) !== LQ_MAX_BONUS_POINTS ||
          parseInt(String(values.timeToZeroBonus)) !== LQ_TIME_TO_ZERO_BONUS

        return (
          <Form className="h-full w-full">
            <CreationFormValidator
              isValid={isValid}
              activeStep={activeStep}
              setStepValidity={setStepValidity}
            />
            <div className="flex h-full w-full flex-col justify-between gap-1">
              <div className="flex flex-col justify-center gap-4 md:flex-row">
                <div
                  className={twMerge(
                    'border-border md:w-128 flex w-full flex-col gap-3 rounded-md border border-solid p-2 shadow-md md:flex-row md:gap-4',
                    values.isGamificationEnabled && 'border-orange-400'
                  )}
                >
                  <div>
                    <div className="mb-1 flex flex-row items-center justify-center gap-2">
                      <FontAwesomeIcon icon={faGears} />
                      <div className="text-lg font-bold">
                        {t('shared.generic.settings')}
                      </div>
                    </div>
                    <SelectField
                      value={values.courseId}
                      onChange={(value) => {
                        setFieldValue('courseId', value)

                        if (value === 'no-course-selected') {
                          setFieldValue('isGamificationEnabled', false)
                          setFieldValue('isAssessmentEnabled', false)
                          setFieldValue('multiplier', '1')
                        } else {
                          const selectedCourse = [
                            ...(gamifiedCourses ?? []),
                            ...(nonGamifiedCourses ?? []),
                            ...(assessmentCourses ?? []),
                          ].find((course) => course.value === value)
                          setFieldValue(
                            'isGamificationEnabled',
                            selectedCourse?.isGamified ?? false
                          )
                          setFieldValue(
                            'isAssessmentEnabled',
                            selectedCourse?.isAssessmentEnabled ?? false
                          )
                        }
                      }}
                      label={t('shared.generic.course')}
                      tooltip={t('manage.activityWizard.liveQuizDescCourse')}
                      placeholder={t(
                        'manage.activityWizard.liveQuizSelectCourse'
                      )}
                      groups={groupedCourses}
                      data={{ cy: 'select-course' }}
                      className={{ tooltip: 'z-20' }}
                    />

                    <div className="mt-2 space-y-0.5 pb-2 pl-1">
                      {selectedCourse?.isGamified &&
                      values.isGamificationEnabled ? (
                        <div className="gap-2.25 flex flex-row items-center pl-0.5">
                          <FontAwesomeIcon
                            icon={values.isGamificationEnabled ? faCheck : faX}
                            className={twMerge(
                              'w-4',
                              values.isGamificationEnabled
                                ? 'text-green-700'
                                : 'text-red-600'
                            )}
                          />
                          {t('shared.generic.gamification')}
                        </div>
                      ) : (
                        <Checkbox
                          label={t('shared.generic.gamification')}
                          checked={values.isGamificationEnabled}
                          onCheck={() =>
                            setFieldValue(
                              'isGamificationEnabled',
                              !values.isGamificationEnabled
                            )
                          }
                        />
                      )}

                      {user?.privatePreview && (
                        <div className="flex flex-row items-center gap-2.5 pl-0.5">
                          <FontAwesomeIcon
                            icon={values.isAssessmentEnabled ? faCheck : faX}
                            className={twMerge(
                              'w-4',
                              values.isAssessmentEnabled
                                ? 'text-green-700'
                                : 'text-red-600'
                            )}
                          />
                          {t('shared.generic.assessment')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 grid grid-cols-9">
                      <div className="col-span-7 col-start-2 flex flex-row items-center justify-center gap-2">
                        <FontAwesomeIcon
                          icon={faCrown}
                          className="text-orange-400"
                        />
                        <div className="text-lg font-bold">
                          {t('shared.generic.gamification')}
                        </div>
                      </div>
                      <div className="h-7 w-7">
                        {values.isGamificationEnabled && (
                          <AdvancedLiveQuizSettings
                            modalOpen={customizedGradingModal}
                            setModalOpen={setCustomizedGradingModal}
                            multiplier={values.multiplier}
                            defaultPointsValue={String(values.defaultPoints)}
                            correctPointsValue={String(
                              values.defaultCorrectPoints
                            )}
                            maxBonusValue={String(values.maxBonusPoints)}
                            timeToZeroValue={String(values.timeToZeroBonus)}
                            showError={
                              !!errors.defaultPoints ||
                              !!errors.defaultCorrectPoints ||
                              !!errors.maxBonusPoints ||
                              !!errors.timeToZeroBonus
                            }
                          />
                        )}
                      </div>
                    </div>

                    {values.isGamificationEnabled ? (
                      <>
                        <MultiplierSelector
                          disabled={!values.isGamificationEnabled}
                          className={{ trigger: 'w-59' }}
                        />
                        <div className="mt-2 flex flex-row items-start gap-2.5">
                          <FontAwesomeIcon
                            icon={customizedGradingEnabled ? faCheck : faX}
                            className={twMerge(
                              'mt-0.75 w-3',
                              customizedGradingEnabled
                                ? 'text-green-700'
                                : 'text-red-600'
                            )}
                          />
                          <span
                            className="text-primary-100 cursor-pointer hover:underline"
                            onClick={() => setCustomizedGradingModal(true)}
                          >
                            {t(
                              'manage.activityWizard.liveQuizCustomizedGrading'
                            )}
                          </span>
                        </div>
                      </>
                    ) : (
                      <UserNotification
                        message={t(
                          'manage.activityWizard.liveQuizGamificationDeactivated'
                        )}
                      />
                    )}
                  </div>
                </div>
                <div className="border-border w-full rounded-md border border-solid p-2 shadow-md md:w-64">
                  <div className="mb-2 flex flex-row items-center justify-center gap-2">
                    <FontAwesomeIcon icon={faUsers} />
                    <div className="text-lg font-bold">
                      {t('shared.generic.interaction')}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <FormikSwitchField
                      required
                      name="isConfusionFeedbackEnabled"
                      label={t('shared.generic.feedbackChannel')}
                      tooltip={t(
                        'manage.activityWizard.liveQuizFeedbackChannel'
                      )}
                      data={{ cy: 'set-feedback-enabled' }}
                    />
                    <FormikSwitchField
                      required
                      name="isLiveQAEnabled"
                      label={t('shared.generic.liveQA')}
                      tooltip={t('manage.activityWizard.liveQuizLiveQA')}
                      data={{ cy: 'set-liveqa-enabled' }}
                    />
                    <FormikSwitchField
                      required
                      disabled={!values.isLiveQAEnabled}
                      name="isModerationEnabled"
                      label={t('shared.generic.moderation')}
                      tooltip={t('manage.activityWizard.liveQuizModeration')}
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
        )
      }}
    </Formik>
  )
}

export default LiveQuizSettingsStep
