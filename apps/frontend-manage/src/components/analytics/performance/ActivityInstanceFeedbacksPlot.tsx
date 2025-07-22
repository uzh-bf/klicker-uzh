import { faX } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityFeedback,
  ActivityType,
  ElementType,
  InstanceFeedback,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Legend } from 'recharts'
import ActivitiesElementsSwitch from '../ActivitiesElementsSwitch'
import ActivityTypeFilter from '../ActivityTypeFilter'
import AnalyticsSearchField from '../AnalyticsSearchField'
import ElementTypeFilter from '../ElementTypeFilter'
import ElementFeedbackBarChart from './ElementFeedbackBarChart'
import useElementFeedbackFilters from './useElementFeedbackFilters'
import useElementFeedbackSearch from './useElementFeedbackSearch'

function ActivityInstanceFeedbacksPlot({
  instanceFeedbacks,
  activityFeedbacks,
}: {
  instanceFeedbacks: InstanceFeedback[]
  activityFeedbacks: ActivityFeedback[]
}) {
  const t = useTranslations()
  const chartColors = {
    upvotes: '#064e3b',
    downvotes: '#cc0000',
  }

  const defaultFilters = {
    type: 'activity' as 'activity' | 'instance',
    activityType: 'all' as ActivityType | 'all',
    elementType: 'all' as ElementType | 'all',
    searchTerm: '',
  }

  // filtering of element feedbacks
  const [type, setType] = useState<'activity' | 'instance'>(defaultFilters.type)
  const [activityType, setActivityType] = useState<ActivityType | 'all'>(
    defaultFilters.activityType
  )
  const [elementType, setElementType] = useState<ElementType | 'all'>(
    defaultFilters.elementType
  )
  const [activitySearchTerm, setActivitySearch] = useState<string>(
    defaultFilters.searchTerm
  )
  const [instanceSearchTerm, setInstanceSearch] = useState<string>(
    defaultFilters.searchTerm
  )

  // setup search
  const { activitySearch, instanceSearch } = useElementFeedbackSearch({
    activityFeedbacks,
    instanceFeedbacks,
  })

  // apply filters and search term to feedbacks
  const entries = useElementFeedbackFilters({
    type,
    activityFeedbacks,
    instanceFeedbacks,
    activityType,
    elementType,
    activitySearchTerm,
    instanceSearchTerm,
    activitySearch,
    instanceSearch,
  })

  const ResetButton = () => (
    <Button
      className={{
        root: 'py-0.25 flex h-8 w-max flex-row items-center gap-2 self-end px-2 shadow-none',
      }}
      disabled={
        type === defaultFilters.type &&
        activityType === defaultFilters.activityType &&
        elementType === defaultFilters.elementType &&
        activitySearchTerm === defaultFilters.searchTerm &&
        instanceSearchTerm === defaultFilters.searchTerm
      }
      onClick={() => {
        setType(defaultFilters.type)
        setActivityType(defaultFilters.activityType)
        setElementType(defaultFilters.elementType)
        setActivitySearch('')
        setInstanceSearch('')
      }}
    >
      <Button.Icon icon={faX} />
      <Button.Label>{t('manage.analytics.resetSelectors')}</Button.Label>
    </Button>
  )

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <div className="flex w-full flex-row justify-between gap-8">
        <H2>{t('manage.analytics.feedbackOverviewActivityInstances')}</H2>
        <ResetButton />
      </div>
      {type === 'activity' ? (
        <div className="flex flex-row items-center gap-8">
          <ActivitiesElementsSwitch type={type} setType={setType} />
          <ActivityTypeFilter
            activityType={activityType}
            setActivityType={setActivityType}
          />
          <AnalyticsSearchField
            type={type}
            value={activitySearchTerm}
            onChange={(value) => setActivitySearch(value)}
          />
        </div>
      ) : (
        <div className="flex flex-row items-center gap-8">
          <ActivitiesElementsSwitch type={type} setType={setType} />
          <ElementTypeFilter
            elementType={elementType}
            setElementType={setElementType}
          />
          <AnalyticsSearchField
            type={type}
            value={instanceSearchTerm}
            onChange={(value) => setInstanceSearch(value)}
          />
        </div>
      )}
      {entries.length > 0 ? (
        <div className="relative">
          <Legend
            layout="horizontal"
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '8px' }}
            formatter={(value: string) => {
              if (value === 'downvotes') {
                return (
                  <span style={{ color: chartColors.downvotes }}>
                    {t('manage.analytics.downvotes')}
                  </span>
                )
              }
              if (value === 'upvotes') {
                return (
                  <span style={{ color: chartColors.upvotes }}>
                    {t('manage.analytics.upvotes')}
                  </span>
                )
              }
              return value
            }}
          />
          <div className="flex flex-col pt-6">
            {entries.length > 0
              ? entries.map((feedback) => (
                  <ElementFeedbackBarChart
                    key={`upvotes-${feedback.id}`}
                    title={
                      feedback.__typename === 'ActivityFeedback'
                        ? feedback.activityName
                        : feedback.__typename === 'InstanceFeedback'
                          ? feedback.instanceName
                          : ''
                    }
                    feedback={feedback}
                    colors={chartColors}
                  />
                ))
              : null}
          </div>
        </div>
      ) : (
        <UserNotification
          type="info"
          message={t('manage.analytics.noEntriesManageFilters')}
          className={{ root: 'mt-4' }}
        />
      )}
    </div>
  )
}

export default ActivityInstanceFeedbacksPlot
