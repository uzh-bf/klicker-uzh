import { faCrown, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useLiveQuizCourseGrouping from '@lib/hooks/useLiveQuizCourseGrouping'
import {
  NewFormikSelectField,
  NewFormikSwitchField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import MultiplierSelector from '../MultiplierSelector'
import { LiveSessionFormValues } from '../MultistepWizard'
import { LiveQuizWizardStepProps } from './LiveSessionWizard'

function LiveQuizSettingsStep(props: LiveQuizWizardStepProps) {
  const t = useTranslations()
  const { values, setFieldValue } = useFormikContext<LiveSessionFormValues>()

  useEffect(() => {
    if (values.courseId === '') {
      setFieldValue('isGamificationEnabled', false)
      setFieldValue('multiplier', '1')
    } else {
      setFieldValue(
        'isGamificationEnabled',
        [...props.gamifiedCourses!, ...props.nonGamifiedCourses!].find(
          (course) => course.value === values.courseId
        )?.isGamified
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.courseId])

  const groupedCourses = useLiveQuizCourseGrouping({
    gamifiedCourses: props.gamifiedCourses ?? [],
    nonGamifiedCourses: props.nonGamifiedCourses ?? [],
  })

  return (
    <div className="flex flex-col md:flex-row gap-4 justify-center">
      <div
        className={twMerge(
          'border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-64 shadow-md',
          values.isGamificationEnabled && 'border-orange-400'
        )}
      >
        <div className="flex flex-row gap-2 items-center justify-center">
          <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
          <div className="text-lg font-bold">
            {t('shared.generic.gamification')}
          </div>
        </div>
        <NewFormikSelectField
          name="courseId"
          label={t('shared.generic.course')}
          tooltip={t('manage.sessionForms.liveQuizDescCourse')}
          placeholder={t('manage.sessionForms.liveQuizSelectCourse')}
          groups={groupedCourses}
          data={{ cy: 'select-course' }}
          className={{ tooltip: 'z-20', label: 'text-base mb-0.5' }}
        />
        {values.isGamificationEnabled ? (
          <MultiplierSelector disabled={!values.isGamificationEnabled} />
        ) : (
          <UserNotification
            message={t('manage.sessionForms.liveQuizEnableGamification')}
            className={{ root: 'mt-2' }}
            type="info"
          />
        )}
      </div>
      <div className="border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-64 shadow-md">
        <div className="flex flex-row gap-2 items-center justify-center mb-4">
          <FontAwesomeIcon icon={faUsers} />
          <div className="text-lg font-bold">
            {t('shared.generic.settings')}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <NewFormikSwitchField
            required
            name="isConfusionFeedbackEnabled"
            label={t('shared.generic.feedbackChannel')}
            tooltip={t('manage.sessionForms.liveQuizFeedbackChannel')}
            data={{ cy: 'set-feedback-enabled' }}
          />
          <NewFormikSwitchField
            required
            name="isLiveQAEnabled"
            label={t('shared.generic.liveQA')}
            tooltip={t('manage.sessionForms.liveQuizLiveQA')}
            data={{ cy: 'set-liveqa-enabled' }}
          />
          <NewFormikSwitchField
            required
            disabled={!values.isLiveQAEnabled}
            name="isModerationEnabled"
            label={t('shared.generic.moderation')}
            tooltip={t('manage.sessionForms.liveQuizModeration')}
            data={{ cy: 'set-liveqa-moderation' }}
          />
        </div>
      </div>
    </div>
  )
}

export default LiveQuizSettingsStep
