import {
  ActivityFeedback,
  InstanceFeedback,
} from '@klicker-uzh/graphql/dist/ops'
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

    const instanceSearch = new JsSearch.Search('elementName')
    instanceSearch.addIndex('elementName')
    instanceSearch.addDocuments(instanceFeedbacks)

    return { activitySearch, instanceSearch }
  }, [activityFeedbacks, instanceFeedbacks])
}

export default useElementFeedbackSearch
