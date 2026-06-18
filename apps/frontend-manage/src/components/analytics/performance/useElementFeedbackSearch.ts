import type { ActivityFeedback, InstanceFeedback } from '@lib/analyticsTypes'
import * as JsSearch from 'js-search'
import { useMemo } from 'react'

function useElementFeedbackSearch({
  activityFeedbacks,
  instanceFeedbacks,
}: {
  activityFeedbacks: ActivityFeedback[]
  instanceFeedbacks: InstanceFeedback[]
}) {
  return useMemo(() => {
    const activitySearch = new JsSearch.Search('activityName')
    activitySearch.addIndex('activityName')
    activitySearch.addDocuments(activityFeedbacks)

    const instanceSearch = new JsSearch.Search('instanceName')
    instanceSearch.addIndex('instanceName')
    instanceSearch.addDocuments(instanceFeedbacks)

    return { activitySearch, instanceSearch }
  }, [activityFeedbacks, instanceFeedbacks])
}

export default useElementFeedbackSearch
