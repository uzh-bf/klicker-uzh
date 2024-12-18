import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function PerformanceActivityTypeFilter({
  activityType,
  setActivityType,
}: {
  activityType: ActivityType | 'all'
  setActivityType: Dispatch<SetStateAction<'all' | ActivityType>>
}) {
  const t = useTranslations()

  return (
    <SelectField
      label={t('manage.analytics.activityType')}
      items={[
        { value: 'all', label: t('manage.analytics.allActivityTypes') },
        {
          value: ActivityType.PracticeQuiz,
          label: t('shared.generic.practiceQuizzes'),
        },
        {
          value: ActivityType.MicroLearning,
          label: t('shared.generic.microlearnings'),
        },
      ]}
      value={activityType}
      onChange={(value) => setActivityType(value as ActivityType | 'all')}
      className={{ select: { root: 'w-52', trigger: 'h-8' } }}
    />
  )
}

export default PerformanceActivityTypeFilter
