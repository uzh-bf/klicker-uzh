import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Label, Select } from '@uzh-bf/design-system'
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
    <div className="flex flex-row items-center gap-3">
      <Label
        label={t('manage.analytics.activityType')}
        className={{ root: 'font-bold' }}
      />
      <Select
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
        className={{ root: 'w-52', trigger: 'h-8' }}
      />
    </div>
  )
}

export default PerformanceActivityTypeFilter
