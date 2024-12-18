import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityPerformance,
  ActivityType,
  ElementType,
  InstancePerformance,
} from '@klicker-uzh/graphql/dist/ops'
import usePerformanceSearch from '@lib/hooks/usePerformanceSearch'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { Legend } from 'recharts'
import ActivitiesElementsSwitch from './ActivitiesElementsSwitch'
import PerformanceActivityTypeFilter from './PerformanceActivityTypeFilter'
import PerformanceAttemptsFilter from './PerformanceAttemptsFilter'
import PerformanceElementTypeFilter from './PerformanceElementTypeFilter'
import PerformanceRatesBarChart from './PerformanceRatesBarChart'
import PerformanceSearchField from './PerformanceSearchField'

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
  const [search, setSearch] = useState<string>('')

  // Use the search hook
  const searchResults = usePerformanceSearch(
    activityPerformances,
    instancePerformances,
    type,
    search
  )

  // Modify the entries useMemo to use searchResults instead of rates
  const entries = useMemo(() => {
    // optionally filter for activity or element type
    const filteredByType = searchResults.filter((entry) => {
      if (
        activityType !== 'all' &&
        entry.__typename === 'ActivityPerformance' &&
        entry.activityType !== activityType
      ) {
        return false
      }

      if (
        elementType !== 'all' &&
        entry.__typename === 'InstancePerformance' &&
        entry.elementType !== elementType
      ) {
        return false
      }

      return true
    })

    // add the name element / activity name to the structure and map it to the local type
    return filteredByType.map((entry) => {
      let incorrectRate = 0
      let partialRate = 0
      let correctRate = 0

      if (attemptsType === 'total') {
        incorrectRate = entry.rates.errorRate
        partialRate = entry.rates.partialRate
        correctRate = entry.rates.correctRate
      } else if (attemptsType === 'first') {
        incorrectRate = entry.rates.firstErrorRate
        partialRate = entry.rates.firstPartialRate
        correctRate = entry.rates.firstCorrectRate
      } else if (attemptsType === 'last') {
        incorrectRate = entry.rates.lastErrorRate
        partialRate = entry.rates.lastPartialRate
        correctRate = entry.rates.lastCorrectRate
      }

      return {
        id: entry.id,
        name:
          entry.__typename === 'ActivityPerformance'
            ? entry.activityName
            : entry.__typename === 'InstancePerformance'
              ? entry.elementName
              : '',
        incorrectRate,
        partialRate,
        correctRate,
      }
    })
  }, [searchResults, activityType, elementType, attemptsType])

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <div className="flex flex-row items-center justify-between">
        <div className="mb-2 flex flex-row gap-8">
          <H2>{t('manage.analytics.activityElementPerformanceRates')}</H2>
          <ActivitiesElementsSwitch type={type} setType={setType} />
        </div>
        <Button
          className={{ root: 'flex h-8 flex-row items-center gap-2' }}
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
          <PerformanceActivityTypeFilter
            activityType={activityType}
            setActivityType={setActivityType}
          />
          <PerformanceSearchField
            type={type}
            value={search}
            onChange={(value) => setSearch(value)}
          />
        </div>
      ) : (
        <div className="flex flex-row items-center gap-8">
          <PerformanceAttemptsFilter
            attemptsType={attemptsType}
            setAttemptsType={setAttemptsType}
          />
          <PerformanceElementTypeFilter
            elementType={elementType}
            setElementType={setElementType}
          />
          <PerformanceSearchField
            type={type}
            value={search}
            onChange={(value) => setSearch(value)}
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
