import { useQuery } from '@apollo/client'
import {
  faCheck,
  faGears,
  faQuestionCircle,
  faTriangleExclamation,
  faUsers,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  LiveQuizResponseCollectionMode,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
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
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { ElementSelectCourse } from '../../ActivityCreation'
import CreationFormValidator from '../CreationFormValidator'
import MultiplierSelector from '../MultiplierSelector'
import type { LiveQuizFormValues } from '../WizardLayout'
import WizardNavigation from '../WizardNavigation'
import AdvancedLiveQuizSettings from './AdvancedLiveQuizSettings'
import { LiveQuizWizardStepProps } from './LiveQuizWizard'

function applyResponseCollectionMode(
  values: LiveQuizFormValues,
  responseCollectionMode: LiveQuizResponseCollectionMode
) {
  return {
    ...values,
    responseCollectionMode,
    isGamificationEnabled:
      responseCollectionMode === LiveQuizResponseCollectionMode.CorrelatedExport
        ? false
        : values.isGamificationEnabled,
  }
}

function applyGamificationSetting(
  values: LiveQuizFormValues,
  isGamificationEnabled: boolean,
  responseCollectionModeLocked: boolean
) {
  if (
    isGamificationEnabled &&
    responseCollectionModeLocked &&
    values.responseCollectionMode ===
      LiveQuizResponseCollectionMode.CorrelatedExport
  ) {
    return values
  }

  return {
    ...values,
    isGamificationEnabled,
    responseCollectionMode:
      isGamificationEnabled &&
      values.responseCollectionMode ===
        LiveQuizResponseCollectionMode.CorrelatedExport
        ? LiveQuizResponseCollectionMode.AggregatedAnonymous
        : values.responseCollectionMode,
  }
}

function applyCourseSelection(
  values: LiveQuizFormValues,
  courseId: string,
  previousCourse: ElementSelectCourse | undefined,
  selectedCourse: ElementSelectCourse | undefined,
  responseCollectionModeLocked: boolean
) {
  let nextValues: LiveQuizFormValues = {
    ...values,
    courseId,
    isGamificationEnabled: previousCourse?.isGamified
      ? false
      : values.isGamificationEnabled,
    isPinProtected: previousCourse?.isAssessmentEnabled
      ? false
      : values.isPinProtected,
  }

  if (courseId === 'no-course-selected') {
    return {
      ...nextValues,
      isAssessmentEnabled: false,
      multiplier: '1',
    }
  }

  if (selectedCourse?.isGamified) {
    nextValues = applyGamificationSetting(
      nextValues,
      true,
      responseCollectionModeLocked
    )
  }

  return {
    ...nextValues,
    isAssessmentEnabled: selectedCourse?.isAssessmentEnabled ?? false,
    isPinProtected: selectedCourse?.isAssessmentEnabled
      ? true
      : nextValues.isPinProtected,
    responseCollectionMode:
      selectedCourse?.isAssessmentEnabled && !responseCollectionModeLocked
        ? LiveQuizResponseCollectionMode.AggregatedAnonymous
        : nextValues.responseCollectionMode,
  }
}

function LiveQuizSettingsStep({
  editMode,
  duplicationMode,
  responseCollectionModeLocked,
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
      {({
        values,
        errors,
        isValid,
        isSubmitting,
        setFieldValue,
        setValues,
      }) => {
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

        // only managers of an assessment course can remove an assessment live quiz from it
        // during duplication course re-assignment should be unlocked
        const courseSelectionDisabled =
          !duplicationMode &&
          values.isAssessmentEnabled &&
          !selectedCourse?.isManager
        const responseCollectionModeDisabled =
          values.isAssessmentEnabled || responseCollectionModeLocked
        const correlatedModeSelected =
          values.responseCollectionMode ===
          LiveQuizResponseCollectionMode.CorrelatedExport
        const lockedCorrelatedMode =
          responseCollectionModeLocked && correlatedModeSelected
        const selectableCourseGroups = lockedCorrelatedMode
          ? groupedCourses.map((group) => ({
              ...group,
              items: group.items.map((item) => {
                const incompatibleCourse = [
                  ...(gamifiedCourses ?? []),
                  ...(assessmentCourses ?? []),
                ].some((course) => course.value === item.value)

                return incompatibleCourse
                  ? {
                      ...item,
                      disabled: true,
                      tooltip: t(
                        'manage.activityWizard.responseCollectionLockedCourseConflict'
                      ),
                    }
                  : item
              }),
            }))
          : groupedCourses

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
                    <div className="flex flex-row items-end gap-2.5">
                      <SelectField
                        disabled={courseSelectionDisabled}
                        value={values.courseId}
                        onChange={(value) => {
                          const prevCourse = values.courseId
                            ? [
                                ...(gamifiedCourses ?? []),
                                ...(nonGamifiedCourses ?? []),
                                ...(assessmentCourses ?? []),
                              ].find(
                                (course) => course.value === values.courseId
                              )
                            : undefined

                          const nextCourse = [
                            ...(gamifiedCourses ?? []),
                            ...(nonGamifiedCourses ?? []),
                            ...(assessmentCourses ?? []),
                          ].find((course) => course.value === value)

                          void setValues(
                            applyCourseSelection(
                              values,
                              value,
                              prevCourse,
                              nextCourse,
                              responseCollectionModeLocked ?? false
                            )
                          )
                        }}
                        label={t('shared.generic.course')}
                        tooltip={t.rich(
                          'manage.activityWizard.liveQuizDescCourse',
                          {
                            link: (text) => (
                              <a
                                href="https://www.klicker.uzh.ch/tutorials/live_quiz/#what-functionalities-become-available-through-gamified-live-quizzes"
                                className="text-primary-100 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {text}
                              </a>
                            ),
                          }
                        )}
                        placeholder={t(
                          'manage.activityWizard.liveQuizSelectCourse'
                        )}
                        groups={selectableCourseGroups}
                        data={{ cy: 'select-course' }}
                        className={{
                          select: {
                            trigger: twMerge(
                              'h-8 w-60',
                              courseSelectionDisabled ? 'w-53' : ''
                            ),
                          },
                          tooltip: 'z-20',
                        }}
                      />
                      {courseSelectionDisabled ? (
                        <Tooltip
                          tooltip={t(
                            'manage.activityWizard.assessmentCourseRemovalRestricted'
                          )}
                        >
                          <FontAwesomeIcon
                            icon={faTriangleExclamation}
                            className="text-uzh-red-100 mb-1"
                          />
                        </Tooltip>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-col pb-2 pl-1">
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
                          disabled={lockedCorrelatedMode}
                          onCheck={() => {
                            const enableGamification =
                              !values.isGamificationEnabled
                            void setValues(
                              applyGamificationSetting(
                                values,
                                enableGamification,
                                responseCollectionModeLocked ?? false
                              )
                            )
                          }}
                          className={{
                            indicator: 'text-xs',
                            root: 'w-4.5 h-4.5',
                          }}
                          data={{ cy: 'set-quiz-gamification' }}
                        />
                      )}

                      {user?.privatePreview && (
                        <div className="flex flex-row items-center gap-2.5 pl-0.5">
                          <FontAwesomeIcon
                            icon={
                              selectedCourse?.isAssessmentEnabled
                                ? faCheck
                                : faX
                            }
                            className={twMerge(
                              'w-4',
                              selectedCourse?.isAssessmentEnabled
                                ? 'text-green-700'
                                : 'text-red-600'
                            )}
                          />
                          {t('shared.generic.assessment')}
                        </div>
                      )}
                      <div className="flex flex-row items-center gap-2.5">
                        {selectedCourse?.isAssessmentEnabled ? (
                          <div className="flex flex-row items-center gap-2.5 pl-0.5">
                            <FontAwesomeIcon
                              icon={faCheck}
                              className="w-4 text-green-700"
                            />
                            {t('manage.activityWizard.pinProtected')}
                          </div>
                        ) : (
                          <Checkbox
                            size="sm"
                            label={t('manage.activityWizard.pinProtected')}
                            checked={values.isPinProtected}
                            onCheck={() =>
                              setFieldValue(
                                'isPinProtected',
                                !values.isPinProtected
                              )
                            }
                            className={{
                              indicator: 'text-xs',
                              root: 'w-4.5 h-4.5',
                            }}
                            data={{ cy: 'set-quiz-pin-protection' }}
                          />
                        )}
                        <Tooltip
                          tooltip={t(
                            'manage.activityWizard.pinProtectedTooltip'
                          )}
                        >
                          <FontAwesomeIcon
                            size="lg"
                            icon={faQuestionCircle}
                            className="text-primary-60"
                          />
                        </Tooltip>
                      </div>
                      <div className="border-border mt-3 border-t pt-3">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            id="response-collection-mode-label"
                            className="text-sm font-bold"
                          >
                            {t('manage.activityWizard.responseCollectionMode')}
                          </span>
                          <Tooltip
                            tooltip={t(
                              'manage.activityWizard.responseCollectionModeTooltip'
                            )}
                          >
                            <FontAwesomeIcon
                              icon={faQuestionCircle}
                              className="text-primary-60"
                            />
                          </Tooltip>
                        </div>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          value={values.responseCollectionMode}
                          disabled={responseCollectionModeDisabled}
                          onValueChange={(value) => {
                            if (
                              value ===
                                LiveQuizResponseCollectionMode.AggregatedAnonymous ||
                              value ===
                                LiveQuizResponseCollectionMode.CorrelatedExport
                            ) {
                              void setValues(
                                applyResponseCollectionMode(values, value)
                              )
                            }
                          }}
                          aria-labelledby="response-collection-mode-label"
                          aria-describedby="response-collection-mode-description"
                          data-cy="set-quiz-response-collection-mode"
                          className="w-full"
                        >
                          <ToggleGroupItem
                            value={
                              LiveQuizResponseCollectionMode.AggregatedAnonymous
                            }
                            className="min-h-10 whitespace-normal px-2 text-xs"
                          >
                            {t(
                              'manage.activityWizard.responseCollectionAggregated'
                            )}
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value={
                              LiveQuizResponseCollectionMode.CorrelatedExport
                            }
                            disabled={selectedCourse?.isGamified}
                            className="min-h-10 whitespace-normal px-2 text-xs"
                          >
                            {t(
                              'manage.activityWizard.responseCollectionCorrelated'
                            )}
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <div
                          id="response-collection-mode-description"
                          className="text-primary-80 mt-1 text-xs leading-4"
                        >
                          <p>
                            {values.isAssessmentEnabled
                              ? t(
                                  'manage.activityWizard.responseCollectionAssessment'
                                )
                              : values.isGamificationEnabled
                                ? t(
                                    'manage.activityWizard.responseCollectionGamificationConflict'
                                  )
                                : values.responseCollectionMode ===
                                    LiveQuizResponseCollectionMode.CorrelatedExport
                                  ? t(
                                      'manage.activityWizard.responseCollectionCorrelatedSummary'
                                    )
                                  : t(
                                      'manage.activityWizard.responseCollectionAggregatedSummary'
                                    )}
                          </p>
                          {!values.isAssessmentEnabled &&
                          responseCollectionModeLocked ? (
                            <p className="mt-1">
                              {t(
                                'manage.activityWizard.responseCollectionLocked'
                              )}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-60">
                    <div className="mb-1 flex flex-row items-center justify-center gap-2 text-lg font-bold">
                      {t('shared.generic.scoring')}
                    </div>

                    {values.isGamificationEnabled ||
                    values.isAssessmentEnabled ? (
                      <>
                        <MultiplierSelector
                          disabled={
                            !values.isGamificationEnabled &&
                            !values.isAssessmentEnabled
                          }
                          className={{ trigger: 'w-58 h-8' }}
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
                            data-cy="live-quiz-advanced-settings"
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
                          'manage.activityWizard.liveQuizNoCustomizedScoring'
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
              <AdvancedLiveQuizSettings
                modalOpen={customizedGradingModal}
                setModalOpen={setCustomizedGradingModal}
                multiplier={values.multiplier}
                defaultPointsValue={String(values.defaultPoints)}
                correctPointsValue={String(values.defaultCorrectPoints)}
                maxBonusValue={String(values.maxBonusPoints)}
                timeToZeroValue={String(values.timeToZeroBonus)}
                showError={
                  !!errors.defaultPoints ||
                  !!errors.defaultCorrectPoints ||
                  !!errors.maxBonusPoints ||
                  !!errors.timeToZeroBonus
                }
              />
            </div>
          </Form>
        )
      }}
    </Formik>
  )
}

export default LiveQuizSettingsStep
