import { useQuery } from '@apollo/client'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import {
  Course,
  GetActiveUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo } from 'react'
import * as yup from 'yup'
import useCoursesGamificationSplit from '../../../../lib/hooks/useCoursesGamificationSplit'
import useLiveQuizCourseGrouping from '../../../../lib/hooks/useLiveQuizCourseGrouping'
import EditorField from '../../creation/EditorField'
import LiveQuizGradingIllustration from '../../creation/liveQuiz/LiveQuizGradingIllustration'
import { ElementSelectCourse } from '../../ElementCreation'
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
            | 'isGroupCreationEnabled'
            | 'startDate'
            | 'endDate'
            | 'groupDeadlineDate'
          >
        ) => ({
          label: course.name,
          value: course.id,
          isGamified: course.isGamificationEnabled,
          isGroupCreationEnabled: course.isGroupCreationEnabled,
          startDate: course.startDate,
          endDate: course.endDate,
          groupDeadline: course.groupDeadlineDate,
        })
      ) ?? [],
    [dataCourses]
  )
  const { gamifiedCourses, nonGamifiedCourses } = useCoursesGamificationSplit({
    courseSelection,
  })
  const groupedCourses = useLiveQuizCourseGrouping({
    gamifiedCourses: gamifiedCourses ?? [],
    nonGamifiedCourses: nonGamifiedCourses ?? [],
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
        }}
        validationSchema={yup.object().shape({
          name: yup.string().required(t('manage.activityWizard.activityName')),
          displayName: yup
            .string()
            .required(t('manage.activityWizard.activityDisplayName')),
          description: yup.string(),
          courseId: yup.string(),
        })}
        onSubmit={(values: {
          name: string
          displayName: string
          description?: string
          courseId?: string
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
        {({ touched, isValid, isSubmitting }) => (
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
                <FormikSelectField
                  name="courseId"
                  label={t('shared.generic.course')}
                  tooltip={t('manage.activityWizard.liveQuizDescCourse')}
                  placeholder={t('manage.activityWizard.liveQuizSelectCourse')}
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
              <div className="bg-uzh-grey-20 mb-4 rounded-md px-4 pb-2 pt-4">
                <div className="flex flex-row gap-2">
                  <div className="font-bold">{t('shared.generic.scoring')}</div>
                  <div>
                    (
                    {`${t('manage.template.forGamifiedCourses')}, ${t('shared.generic.multiplier')}: ${quizData.multiplier}x`}
                    )
                  </div>
                </div>
                <LiveQuizGradingIllustration
                  defaultPointsValue={String(quizData.defaultPoints)}
                  correctPointsValue={String(quizData.defaultCorrectPoints)}
                  maxBonusValue={String(quizData.maxBonusPoints)}
                  timeToZeroValue={String(quizData.timeToZeroBonus)}
                  multiplier={quizData.multiplier}
                />
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
        )}
      </Formik>
    </div>
  )
}

export default LiveQuizTemplateSettings
