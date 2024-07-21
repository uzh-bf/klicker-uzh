import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  NewFormikDateField,
  NewFormikSelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import MultiplierSelector from '../MultiplierSelector'
import { MicroLearningFormValues } from '../MultistepWizard'
import { MicroLearningWizardStepProps } from './MicroLearningWizard'

function MicroLearningSettingsStep(props: MicroLearningWizardStepProps) {
  const t = useTranslations()
  const [courseGamified, setCourseGamified] = useState(false)
  const { values, setTouched } = useFormikContext<MicroLearningFormValues>()

  const groupedCourses = useGamifiedCourseGrouping({
    gamifiedCourses: props.gamifiedCourses ?? [],
    nonGamifiedCourses: props.nonGamifiedCourses ?? [],
  })

  useEffect(() => {
    if (values.courseId) {
      const course = props.gamifiedCourses?.find(
        (course) => course.value === values.courseId
      )
      setCourseGamified(!!course)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.courseId])

  useEffect(() => {
    setTouched({ startDate: true, endDate: true })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.startDate, values.endDate])

  return (
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
          tooltip={t('manage.sessionForms.microlearningCourse')}
          placeholder={t('manage.sessionForms.selectCourse')}
          groups={groupedCourses}
          data={{ cy: 'select-course' }}
          className={{ tooltip: 'z-20', label: 'text-base mb-0.5' }}
        />

        {typeof values.courseId === 'undefined' ? (
          <UserNotification
            message={t('manage.sessionForms.microLearningMissingCourse')}
            className={{ root: 'mt-2' }}
            type="warning"
          />
        ) : courseGamified ? (
          <MultiplierSelector />
        ) : (
          <UserNotification
            message={t('manage.sessionForms.microLearningCourseNotGamified')}
            className={{ root: 'mt-2' }}
            type="info"
          />
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
            tooltip={t('manage.sessionForms.microlearningStartDate')}
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
            tooltip={t('manage.sessionForms.microlearningEndDate')}
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

export default MicroLearningSettingsStep
