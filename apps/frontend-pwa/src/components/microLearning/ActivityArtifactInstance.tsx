import { useQuery } from '@apollo/client'
import { ActivityArtifactForInstanceDocument } from '@klicker-uzh/graphql/dist/ops'
import ActivityArtifactFrame from '@klicker-uzh/shared-components/src/ActivityArtifactFrame'
import type { ActivityArtifactExercise } from '@klicker-uzh/types'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations()
  const { data, refetch } = useQuery(ActivityArtifactForInstanceDocument, {
    variables: { elementInstanceId },
    fetchPolicy: 'no-cache',
  })

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        // A denied or transient refresh keeps the last rendered state without
        // producing an unhandled promise rejection when the tab returns.
        refetch().catch(() => undefined)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refetch])

  const result = data?.activityArtifactForInstance
  if (!result) return null

  if (!result.available || !result.artifact) {
    return (
      <UserNotification type="info">
        {t('pwa.practiceQuiz.activityArtifactUnavailable')}
      </UserNotification>
    )
  }

  return (
    <ActivityArtifactFrame
      frameUrl={result.artifact.frameUrl}
      canonicalUrl={result.artifact.url}
      title={result.artifact.title}
      exercise={result.artifact.exercise as ActivityArtifactExercise}
      className="h-[420px] w-full rounded border border-slate-300"
    />
  )
}

export default ActivityArtifactInstance
