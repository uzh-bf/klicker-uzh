import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityPerformance,
  ActivityType,
  ElementType,
  InstancePerformance,
} from '@klicker-uzh/graphql/dist/ops'
import usePerformanceRates from '@lib/hooks/usePerformanceRates'
import usePerformanceSearch from '@lib/hooks/usePerformanceSearch'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Legend } from 'recharts'
import ActivitiesElementsSwitch from '../ActivitiesElementsSwitch'
import ActivityTypeFilter from '../ActivityTypeFilter'
import AnalyticsSearchField from '../AnalyticsSearchField'
import ElementTypeFilter from '../ElementTypeFilter'
import PerformanceAttemptsFilter from './PerformanceAttemptsFilter'
import PerformanceRatesBarChart from './PerformanceRatesBarChart'

interface PerformanceRatesProps {
  activityPerformances: ActivityPerformance[]
  instancePerformances: InstancePerformance[]
}

function PerformanceRates({
  activityPerformances,
  instancePerformances,
}: PerformanceRatesProps) {
  const t = useTranslations()
  const chartColors = {
    correct: '#064e3b',
    partial: '#f59e0b',
    incorrect: '#cc0000',
  }
  const defaultFilters = {
    type: 'activity' as 'activity' | 'instance',
    attemptsType: 'total' as 'first' | 'last' | 'total',
    activityType: 'all' as ActivityType | 'all',
    elementType: 'all' as ElementType | 'all',
  }

  // define parameters for filtering and searching
  const [type, setType] = useState<'activity' | 'instance'>(defaultFilters.type)
  const [attemptsType, setAttemptsType] = useState<'first' | 'last' | 'total'>(
    defaultFilters.attemptsType
  )
  const [activityType, setActivityType] = useState<ActivityType | 'all'>(
    defaultFilters.activityType
  )
  const [elementType, setElementType] = useState<ElementType | 'all'>(
    defaultFilters.elementType
  )
  const [activitySearch, setActivitySearch] = useState<string>('')
  const [instanceSearch, setInstanceSearch] = useState<string>('')

  // apply the search hook
  const searchResults = usePerformanceSearch(
    activityPerformances,
    instancePerformances,
    type,
    type === 'activity' ? activitySearch : instanceSearch
  )

  // if any filters are provided, narrow down the performance rate entries shown
  const entries = usePerformanceRates(
    searchResults,
    activityType,
    elementType,
    attemptsType
  )

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <div className="flex flex-row items-center justify-between">
        <div className="mb-2 flex flex-row gap-8">
          <H2>{t('manage.analytics.activityElementPerformanceRates')}</H2>
          <ActivitiesElementsSwitch type={type} setType={setType} />
        </div>
        <Button
          className={{
            root: 'py-0.25 flex h-8 flex-row items-center gap-2 px-2',
          }}
          disabled={
            type === defaultFilters.type &&
            attemptsType === defaultFilters.attemptsType &&
            activityType === defaultFilters.activityType &&
            elementType === defaultFilters.elementType
          }
          onClick={() => {
            setType(defaultFilters.type)
            setAttemptsType(defaultFilters.attemptsType)
            setActivityType(defaultFilters.activityType)
            setElementType(defaultFilters.elementType)
            setActivitySearch('')
            setInstanceSearch('')
          }}
        >
          <FontAwesomeIcon icon={faX} />
          <div>{t('manage.analytics.resetSelectors')}</div>
        </Button>
      </div>
      {type === 'activity' ? (
        <div className="flex flex-row items-center gap-8">
          <PerformanceAttemptsFilter
            attemptsType={attemptsType}
            setAttemptsType={setAttemptsType}
          />
          <ActivityTypeFilter
            activityType={activityType}
            setActivityType={setActivityType}
          />
          <AnalyticsSearchField
            type={type}
            value={activitySearch}
            onChange={(value) => setActivitySearch(value)}
          />
        </div>
      ) : (
        <div className="flex flex-row items-center gap-8">
          <PerformanceAttemptsFilter
            attemptsType={attemptsType}
            setAttemptsType={setAttemptsType}
          />
          <ElementTypeFilter
            elementType={elementType}
            setElementType={setElementType}
          />
          <AnalyticsSearchField
            type={type}
            value={instanceSearch}
            onChange={(value) => setInstanceSearch(value)}
          />
        </div>
      )}
      {entries.length > 0 ? (
        <div className="relative">
          <Legend
            payload={[
              {
                value: t('manage.analytics.errorRate'),
                color: chartColors.incorrect,
                type: 'rect',
              },
              {
                value: t('manage.analytics.partialRate'),
                color: chartColors.partial,
                type: 'rect',
              },
              {
                value: t('manage.analytics.correctRate'),
                color: chartColors.correct,
                type: 'rect',
              },
            ]}
            wrapperStyle={{ top: 0, right: 0 }}
          />
          <div className="flex flex-col pt-6">
            {entries.length > 0 && (
              <div className="max-h-[13rem] overflow-y-scroll">
                {entries.map((progress) => (
                  <PerformanceRatesBarChart
                    key={`performance-rates-${progress.id}`}
                    title={progress.name}
                    rates={progress}
                    colors={chartColors}
                  />
                ))}
              </div>
            )}
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

export default PerformanceRates
