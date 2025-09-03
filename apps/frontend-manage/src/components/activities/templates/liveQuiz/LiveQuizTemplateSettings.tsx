import { useQuery } from '@apollo/client'
import { faCheck, faInfoCircle, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Course,
  GetActiveUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  Checkbox,
  FormikTextField,
  SelectField,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo } from 'react'
import * as yup from 'yup'
import useCoursesGamificationSplit from '../../../../lib/hooks/useCoursesGamificationSplit'
import useLiveQuizCourseGrouping from '../../../../lib/hooks/useLiveQuizCourseGrouping'
import { ElementSelectCourse } from '../../ActivityCreation'
import EditorField from '../../creation/EditorField'
import LiveQuizGradingIllustration from '../../creation/liveQuiz/LiveQuizGradingIllustration'
import { TemplateCollapsibleUIStates } from '../SectionCollapsible'
import TouchMonitor from '../TouchMonitor'
import { LiveQuizTemplateFormValues } from '../types'

function LiveQuizTemplateSettings({
  quizData,
  setQuizData,
  setCollapsibles,
  setClosingSettingsDisabled,
}: {
  quizData: LiveQuizTemplateFormValues
  setQuizData: Dispatch<SetStateAction<LiveQuizTemplateFormValues>>
  setCollapsibles: Dispatch<SetStateAction<TemplateCollapsibleUIStates>>
  setClosingSettingsDisabled: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const { data: dataCourses } = useQuery(GetActiveUserCoursesDocument, {
    fetchPolicy: 'cache-and-network',
  })

  const courseSelection = useMemo(
    (): ElementSelectCourse[] =>
      dataCourses?.getActiveUserCourses?.map(
        (
          course: Pick<
            Course,
            | 'id'
            | 'name'
            | 'isGamificationEnabled'
            | 'isAssessmentEnabled'
            | 'isGroupCreationEnabled'
            | 'startDate'
            | 'endDate'
            | 'groupDeadlineDate'
          >
        ) => ({
          label: course.name,
          value: course.id,
          isGamified: course.isGamificationEnabled,
          isAssessmentEnabled: course.isAssessmentEnabled,
          isGroupCreationEnabled: course.isGroupCreationEnabled,
          startDate: course.startDate,
          endDate: course.endDate,
          groupDeadline: course.groupDeadlineDate,
        })
      ) ?? [],
    [dataCourses]
  )
  const { gamifiedCourses, nonGamifiedCourses, assessmentCourses } =
    useCoursesGamificationSplit({
      courseSelection,
    })
  const groupedCourses = useLiveQuizCourseGrouping({
    gamifiedCourses: gamifiedCourses,
    nonGamifiedCourses: nonGamifiedCourses,
    assessmentCourses: assessmentCourses,
  })

  return (
    <div>
      <div className="mb-4 text-gray-700">
        {t('manage.template.settingsInstructions')}
      </div>

      <Formik
        enableReinitialize
        validateOnMount
        initialValues={{
          name: quizData.name,
          displayName: quizData.displayName,
          description: quizData.description || '',
          courseId: quizData.courseId || '',
          isGamificationEnabled: quizData.isGamificationEnabled || false,
          isAssessmentEnabled: quizData.isAssessmentEnabled || false,
        }}
        validationSchema={yup.object().shape({
          name: yup.string().required(t('manage.activityWizard.activityName')),
          displayName: yup
            .string()
            .required(t('manage.activityWizard.activityDisplayName')),
          description: yup.string(),
          courseId: yup.string(),
          isGamificationEnabled: yup.boolean(),
          isAssessmentEnabled: yup.boolean(),
        })}
        onSubmit={(values: {
          name: string
          displayName: string
          description?: string
          courseId?: string
          isGamificationEnabled?: boolean
          isAssessmentEnabled?: boolean
        }) => {
          // update quiz data with new values
          setQuizData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              name: values.name,
              displayName: values.displayName,
              description: values.description,
              courseId: values.courseId,
              isGamificationEnabled: values.isGamificationEnabled ?? false,
              settingsProcessed: true,
            }
          })

          // mark settings step as completed and open next step (if defined)
          setCollapsibles((prev) => {
            const nextStep = prev[0][0]
            return typeof nextStep !== 'undefined'
              ? {
                  ...prev,
                  [0]: {
                    ...prev[0],
                    [0]: {
                      open: true,
                      status: nextStep.status,
                    },
                  },
                  settings: {
                    open: false,
                    status: 'success',
                  },
                }
              : {
                  ...prev,

                  settings: {
                    open: false,
                    status: 'success',
                  },
                }
          })

          // enable closing the settings step again
          setClosingSettingsDisabled(false)
        }}
      >
        {({ values, touched, isValid, isSubmitting, setFieldValue }) => {
          // get the currently selected course to correctly display gamification options
          const selectedCourse = courseSelection.find(
            (course) => course.value === values.courseId
          )

          return (
            <Form className="flex flex-col gap-4 md:flex-row">
              <TouchMonitor
                touched={Object.values(touched).some((t) => t)}
                onTouch={() => setClosingSettingsDisabled(true)}
              />
              <div className="flex w-full flex-col md:w-1/2 lg:w-2/3">
                <div className="flex flex-row gap-3">
                  <FormikTextField
                    required
                    name="name"
                    label={t('manage.activityWizard.name')}
                    tooltip={t('manage.activityWizard.liveQuizName')}
                    className={{
                      root: 'mb-4 w-full',
                      tooltip: 'z-20',
                    }}
                    data={{ cy: 'template-live-quiz-name' }}
                  />
                  <SelectField
                    value={values.courseId}
                    onChange={(newValue) => {
                      // find the selected course to set the gamification and assessment settings correctly
                      const newSelectedCourse = courseSelection.find(
                        (course) => course.value === newValue
                      )

                      // set the gamification and assessment booleans according to the course settings
                      setFieldValue(
                        'isGamificationEnabled',
                        newSelectedCourse?.isGamified ?? false
                      )
                      setFieldValue(
                        'isAssessmentEnabled',
                        newSelectedCourse?.isAssessmentEnabled ?? false
                      )

                      // set course id value
                      setFieldValue('courseId', newValue)
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
                    groups={groupedCourses}
                    data={{ cy: 'template-live-quiz-course' }}
                    className={{
                      tooltip: 'z-20',
                      select: { trigger: 'h-9' },
                    }}
                  />
                </div>

                <FormikTextField
                  required
                  name="displayName"
                  label={t('manage.activityWizard.displayName')}
                  tooltip={t('manage.activityWizard.displayNameTooltip')}
                  className={{
                    root: 'mb-4 w-full',
                    tooltip: 'z-20',
                  }}
                  data={{ cy: 'template-live-quiz-display-name' }}
                />

                <EditorField
                  fieldName="description"
                  label={t('shared.generic.description')}
                  tooltip={t('manage.activityWizard.liveQuizDescField')}
                  showToolbarOnFocus={false}
                  data={{ cy: 'template-live-quiz-description' }}
                />
              </div>

              <div className="flex flex-col md:w-1/2 lg:w-1/3">
                <div className="flex h-8 flex-row items-center gap-4 px-2 pb-1">
                  <div className="font-bold">
                    {t('shared.generic.configuration')}:
                  </div>
                  {selectedCourse?.isGamified ? (
                    <div className="flex flex-row items-center gap-2">
                      <FontAwesomeIcon
                        icon={faCheck}
                        className="text-green-700"
                      />
                      <span>{t('shared.generic.gamification')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-row items-center gap-2">
                      <Checkbox
                        checked={values.isGamificationEnabled ?? false}
                        onCheck={() =>
                          setFieldValue(
                            'isGamificationEnabled',
                            !values.isGamificationEnabled
                          )
                        }
                      />
                      <span>{t('shared.generic.gamification')}</span>
                    </div>
                  )}
                  <div className="flex flex-row items-center gap-2">
                    <FontAwesomeIcon
                      icon={selectedCourse?.isAssessmentEnabled ? faCheck : faX}
                      className={
                        selectedCourse?.isAssessmentEnabled
                          ? 'text-green-700'
                          : 'text-red-700'
                      }
                    />
                    <span>{t('shared.generic.assessment')}</span>
                  </div>
                </div>
                <div className="bg-uzh-grey-20 mb-3 rounded-md px-4 pb-2 pt-4">
                  {values.isGamificationEnabled ||
                  values.isAssessmentEnabled ? (
                    <>
                      <div className="flex flex-row gap-2">
                        <div className="font-bold">
                          {t('shared.generic.scoring')}
                        </div>
                        <div>
                          (
                          {`${t('manage.template.forGamifiedCourses')}, ${t('shared.generic.multiplier')}: ${quizData.multiplier}x`}
                          )
                        </div>
                      </div>
                      <LiveQuizGradingIllustration
                        defaultPointsValue={String(quizData.defaultPoints)}
                        correctPointsValue={String(
                          quizData.defaultCorrectPoints
                        )}
                        maxBonusValue={String(quizData.maxBonusPoints)}
                        timeToZeroValue={String(quizData.timeToZeroBonus)}
                        multiplier={quizData.multiplier}
                      />
                    </>
                  ) : (
                    <div className="h-63.75 flex flex-col items-center justify-center px-4">
                      <div className="flex flex-row items-center gap-2.5 text-lg">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <span className="font-bold">
                          {t('manage.template.gamificationDisabled')}
                        </span>
                      </div>
                      <div className="mt-2 text-center">
                        {t('manage.template.gamificationDisabledInfo')}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    primary
                    data={{ cy: 'submit-template-settings' }}
                  >
                    <Button.Icon icon={faCheck} />
                    <Button.Label>
                      {t('manage.template.confirmSettings')}
                    </Button.Label>
                  </Button>
                </div>
              </div>
            </Form>
          )
        }}
      </Formik>
    </div>
  )
}

export default LiveQuizTemplateSettings
