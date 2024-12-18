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
  const search = useMemo(() => {
    const searchInstance = new JsSearch.Search(
      type === 'activity' ? 'activityName' : 'elementName'
    )

    searchInstance.addIndex(
      type === 'activity' ? 'activityName' : 'elementName'
    )

    const items =
      type === 'activity' ? activityPerformances : instancePerformances
    searchInstance.addDocuments(items)

    return searchInstance
  }, [type, activityPerformances, instancePerformances])

  const results = useMemo(() => {
    if (!searchTerm) {
      return type === 'activity' ? activityPerformances : instancePerformances
    }

    return search.search(searchTerm) as (
      | ActivityPerformance
      | InstancePerformance
    )[]
  }, [search, searchTerm, type, activityPerformances, instancePerformances])

  return results
}

export default usePerformanceSearch
