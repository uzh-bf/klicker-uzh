import {
  ActivityPerformance,
  InstancePerformance,
} from '@klicker-uzh/graphql/dist/ops'
import * as JsSearch from 'js-search'
import { useMemo } from 'react'

function usePerformanceSearch(
  activityPerformances: ActivityPerformance[],
  instancePerformances: InstancePerformance[],
  type: 'activity' | 'instance',
  searchTerm: string
) {
  const { activitySearch, instanceSearch } = useMemo(() => {
    const activitySearch = new JsSearch.Search('activityName')
    activitySearch.addIndex('activityName')
    activitySearch.addDocuments(activityPerformances)

    const instanceSearch = new JsSearch.Search('elementName')
    instanceSearch.addIndex('elementName')
    instanceSearch.addDocuments(instancePerformances)

    return { activitySearch, instanceSearch }
  }, [activityPerformances, instancePerformances])

  const results = useMemo(() => {
    // sanitize search term
    const sanitizedSearchTerm = searchTerm.trim().toLowerCase()

    if (!sanitizedSearchTerm) {
      return type === 'activity' ? activityPerformances : instancePerformances
    }

    if (type === 'activity') {
      return activitySearch.search(sanitizedSearchTerm) as ActivityPerformance[]
    } else {
      return instanceSearch.search(sanitizedSearchTerm) as InstancePerformance[]
    }
  }, [
    searchTerm,
    type,
    activityPerformances,
    instancePerformances,
    activitySearch,
    instanceSearch,
  ])

  return results
}

export default usePerformanceSearch
