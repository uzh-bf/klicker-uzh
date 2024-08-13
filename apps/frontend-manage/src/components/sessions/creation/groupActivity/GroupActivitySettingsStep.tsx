import { faClock, faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  NewFormikDateField,
  NewFormikSelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import MultiplierSelector from '../MultiplierSelector'
import { GroupActivityFormValues } from '../MultistepWizard'
import { GroupActivityWizardStepProps } from './GroupActivityWizard'

function GroupActivitySettingsStep(props: GroupActivityWizardStepProps) {
  const t = useTranslations()
  const { values, setTouched } = useFormikContext<GroupActivityFormValues>()

  const groupedCourses = useGamifiedCourseGrouping({
    gamifiedCourses: props.gamifiedCourses ?? [],
    nonGamifiedCourses:
      props.nonGamifiedCourses?.map((course) => {
        return { ...course, disabled: true }
      }) ?? [],
  })

  useEffect(() => {
    setTouched({ startDate: true, endDate: true })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.startDate, values.endDate])

  return (
    <div className="flex flex-col md:flex-row gap-4 justify-center">
      <div
        className={twMerge(
          'border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-72 shadow-md',
          typeof values.courseId !== 'undefined' && 'border-orange-400'
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
          tooltip={t('manage.sessionForms.groupActivityCourse')}
          placeholder={t('manage.sessionForms.selectCourse')}
          groups={groupedCourses}
          data={{ cy: 'select-course' }}
          className={{ tooltip: 'z-20', label: 'text-base mb-0.5' }}
        />

        {typeof values.courseId === 'undefined' ? (
          <UserNotification
            message={t('manage.sessionForms.groupActivityMissingCourse')}
            className={{ root: 'mt-2' }}
            type="warning"
          />
        ) : (
          <MultiplierSelector />
        )}
      </div>
      <div className="border border-solid p-2 border-uzh-grey-40 rounded-md w-full md:w-72 shadow-md">
        <div className="flex flex-row gap-2 items-center justify-center">
          <FontAwesomeIcon icon={faClock} />
          <div className="text-lg font-bold">
            {t('shared.generic.availability')}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <NewFormikDateField
            label={t('shared.generic.startDate')}
            name="startDate"
            tooltip={t('manage.sessionForms.groupActivityStartDate')}
            required
            className={{
              root: 'w-full',
              field: 'w-full',
              label: 'text-base mb-0.5',
              tooltip: 'z-20',
            }}
            data={{ cy: 'select-start-date' }}
          />
          <NewFormikDateField
            label={t('shared.generic.endDate')}
            name="endDate"
            tooltip={t('manage.sessionForms.groupActivityEndDate')}
            required
            className={{
              root: 'w-full',
              field: 'w-full',
              label: 'text-base mb-0.5',
              tooltip: 'z-20',
            }}
            data={{ cy: 'select-end-date' }}
          />
        </div>
      </div>
    </div>
  )
}

export default GroupActivitySettingsStep
