import {
  ActivityFeedback,
  ActivityType,
  ElementType,
  InstanceFeedback,
} from '@klicker-uzh/graphql/dist/ops'
import type { Search } from 'js-search'
import { useMemo } from 'react'

function useElementFeedbackFilters({
  type,
  activityFeedbacks,
  instanceFeedbacks,
  activityType,
  elementType,
  activitySearchTerm,
  instanceSearchTerm,
  activitySearch,
  instanceSearch,
}: {
  type: 'activity' | 'instance'
  activityFeedbacks: ActivityFeedback[]
  instanceFeedbacks: InstanceFeedback[]
  activityType: ActivityType | 'all'
  elementType: ElementType | 'all'
  activitySearchTerm: string
  instanceSearchTerm: string
  activitySearch: Search
  instanceSearch: Search
}) {
  return useMemo(() => {
    if (type === 'activity') {
      const rawData = activityFeedbacks

      // filter by activity type
      const typeFiltered = rawData.filter((feedback) => {
        if (activityType === 'all') {
          return true
        }

        return feedback.activityType === activityType
      })

      // filter by search word
      const sanitizedSearchTerm = activitySearchTerm.trim().toLowerCase()
      if (sanitizedSearchTerm) {
        return activitySearch.search(sanitizedSearchTerm) as ActivityFeedback[]
      }

      return typeFiltered
    } else {
      const rawData = instanceFeedbacks

      // filter by element type
      const typeFiltered = rawData.filter((feedback) => {
        if (elementType === 'all') {
          return true
        }

        return feedback.instanceType === elementType
      })

      // filter by search word
      const sanitizedSearchTerm = instanceSearchTerm.trim().toLowerCase()
      if (sanitizedSearchTerm) {
        return instanceSearch.search(sanitizedSearchTerm) as InstanceFeedback[]
      }

      return typeFiltered
    }
  }, [
    type,
    activityFeedbacks,
    instanceFeedbacks,
    activitySearchTerm,
    instanceSearchTerm,
    activityType,
    activitySearch,
    elementType,
    instanceSearch,
  ])
}

export default useElementFeedbackFilters
