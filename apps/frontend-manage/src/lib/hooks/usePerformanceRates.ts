import {
  ActivityPerformance,
  ActivityType,
  ElementType,
  InstancePerformance,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

interface PerformanceEntry {
  id: number
  name: string
  participantCount: number
  incorrectRate: number
  partialRate: number
  correctRate: number
}

function usePerformanceRates(
  searchResults: (ActivityPerformance | InstancePerformance)[],
  activityType: ActivityType | 'all',
  elementType: ElementType | 'all',
  attemptsType: 'first' | 'last' | 'total'
): PerformanceEntry[] {
  return useMemo(() => {
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
        participantCount: entry.participantCount,
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
}

export default usePerformanceRates
