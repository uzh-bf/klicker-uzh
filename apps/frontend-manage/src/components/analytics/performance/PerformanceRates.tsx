import {
  ActivityPerformance,
  ActivityType,
  ElementType,
  InstancePerformance,
} from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Legend } from 'recharts'
import PerformanceRatesBarChart from './PerformanceRatesBarChart'

interface PerformanceRatesProps {
  activityPerformances: ActivityPerformance[]
  instancePerformances: InstancePerformance[]
}

// TODO: change this to only have one incorrect, one partial and one correct entry
interface PerformanceBarType {
  id: number
  name: string
  incorrectRate: number
  partialRate: number
  correctRate: number
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

  // define parameters for filtering and searching
  const [entries, setEntries] = useState<PerformanceBarType[]>([])
  const [type, setType] = useState<'activity' | 'instance'>('activity')
  const [performanceType, setPerformanceType] = useState<
    'first' | 'last' | 'total'
  >('total')
  const [activityType, setActivityType] = useState<ActivityType | undefined>(
    undefined
  )
  const [elementType, setElementType] = useState<undefined | ElementType>(
    undefined
  )
  const [search, setSearch] = useState<string>('')

  // TODO: extract to custom hook
  // filter and search entries
  useEffect(() => {
    // select the correct performance rates based on the type
    const rates =
      type === 'activity' ? activityPerformances : instancePerformances

    // optionally filter for activity or element type
    const filteredByType = rates.filter((entry) => {
      if (
        typeof activityType !== 'undefined' &&
        entry.__typename === 'ActivityPerformance' &&
        entry.activityType !== activityType
      ) {
        return false
      }

      if (
        typeof elementType !== 'undefined' &&
        entry.__typename === 'InstancePerformance' &&
        entry.elementType !== elementType
      ) {
        return false
      }

      return true
    })

    // TODO: implement search with JSSearch
    // const filteredBySearch = filteredByType.filter((entry) =>
    //   entry.activityName.toLowerCase().includes(search.toLowerCase())
    // )
    // setEntries(filteredBySearch)

    // add the name element / activity name to the structure and map it to the local type
    const performances = filteredByType.map((entry) => {
      let incorrectRate = 0
      let partialRate = 0
      let correctRate = 0

      if (performanceType === 'total') {
        incorrectRate = entry.rates.errorRate
        partialRate = entry.rates.partialRate
        correctRate = entry.rates.correctRate
      } else if (performanceType === 'first') {
        incorrectRate = entry.rates.firstErrorRate
        partialRate = entry.rates.firstPartialRate
        correctRate = entry.rates.firstCorrectRate
      } else if (performanceType === 'last') {
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

    setEntries(performances)
  }, [
    activityPerformances,
    instancePerformances,
    type,
    performanceType,
    activityType,
    elementType,
    search,
  ])

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.activityElementPerformanceRates')}</H2>
      FILTERING (first / last / total / activity or element type / switch
      activities and elements) & SEARCH PLACEHOLDER
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
    </div>
  )
}

export default PerformanceRates
