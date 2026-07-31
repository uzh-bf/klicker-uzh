import { faX } from '@fortawesome/free-solid-svg-icons'
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
import ActivitiesElementsSwitch from '../ActivitiesElementsSwitch'
import ActivityTypeFilter from '../ActivityTypeFilter'
import AnalyticsSearchField from '../AnalyticsSearchField'
import ElementTypeFilter from '../ElementTypeFilter'
import ErrorRatesLegend from './ErrorRatesLegend'
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

  const ResetButton = () => (
    <Button
      className={{
        root: 'h-8 self-end py-0',
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
      <Button.Icon icon={faX} />
      <Button.Label>{t('manage.analytics.resetSelectors')}</Button.Label>
    </Button>
  )

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <div className="flex flex-row items-center justify-between">
        <div className="flex w-full flex-row justify-between gap-8">
          <H2>{t('manage.analytics.activityElementPerformanceRates')}</H2>
          <ResetButton />
        </div>
      </div>
      {type === 'activity' ? (
        <div className="mb-3 flex flex-col gap-1 lg:flex-row lg:gap-8">
          <ActivitiesElementsSwitch type={type} setType={setType} />
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
        <div className="mb-3 flex flex-col gap-1 lg:flex-row lg:gap-8">
          <ActivitiesElementsSwitch type={type} setType={setType} />
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
          <div className="flex flex-col">
            <ErrorRatesLegend colors={chartColors} />
            {entries.length > 0
              ? entries.map((progress) => (
                  <PerformanceRatesBarChart
                    key={`performance-rates-${progress.id}`}
                    title={progress.name}
                    effectiveN={progress.participantCount}
                    rates={progress}
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

export default PerformanceRates
