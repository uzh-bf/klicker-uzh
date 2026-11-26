import { useQuery } from '@apollo/client'
import { ActivityArtifactForInstanceDocument } from '@klicker-uzh/graphql/dist/ops'
import ActivityArtifactFrame from '@klicker-uzh/shared-components/src/ActivityArtifactFrame'
import type { ActivityArtifactExercise } from '@klicker-uzh/types'
import { useEffect } from 'react'

/**
 * Participant side of the run read. The browser contributes only the element
 * instance id from the rendered activity; participant, course and pinned
 * revision are checked on the server. Each mount and each return to the page
 * asks the server again, so a withdrawn flag or membership takes effect on
 * the next fresh response.
 */
function ActivityArtifactInstance({
  elementInstanceId,
}: {
  elementInstanceId: number
}) {
  const { data, refetch } = useQuery(ActivityArtifactForInstanceDocument, {
    variables: { elementInstanceId },
    fetchPolicy: 'no-cache',
  })

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') void refetch()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refetch])

  const artifact = data?.activityArtifactForInstance
  if (!artifact) return null

  return (
    <ActivityArtifactFrame
      frameUrl={artifact.frameUrl}
      canonicalUrl={artifact.url}
      title={artifact.title}
      exercise={artifact.exercise as ActivityArtifactExercise}
      className="h-[420px] w-full rounded border border-slate-300"
    />
  )
}

export default ActivityArtifactInstance
