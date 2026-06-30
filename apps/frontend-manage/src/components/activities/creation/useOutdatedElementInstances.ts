import { useCallback, useEffect, useMemo, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import type { OutdatedInstancesRefetchFunction } from './InstanceUpdateOption'

export function useOutdatedElementInstances({
  enabled,
  instanceIds,
}: {
  enabled: boolean
  instanceIds: number[]
}) {
  const utils = trpc.useUtils()
  const [queryInstanceIds, setQueryInstanceIds] = useState(instanceIds)

  useEffect(() => {
    setQueryInstanceIds(instanceIds)
  }, [instanceIds])

  const { data, isFetching, refetch } =
    trpc.activity.outdatedElementInstances.useQuery(
      { instanceIds: queryInstanceIds },
      {
        enabled: enabled && queryInstanceIds.length > 0,
        refetchOnMount: 'always',
        staleTime: 0,
      }
    )

  const outdatedInstances = useMemo(
    () => data?.outdatedElementInstances ?? [],
    [data?.outdatedElementInstances]
  )

  const refetchOutdatedInstances =
    useCallback<OutdatedInstancesRefetchFunction>(
      async (variables) => {
        if (variables) {
          setQueryInstanceIds(variables.instanceIds)

          if (enabled && variables.instanceIds.length > 0) {
            await utils.activity.outdatedElementInstances.fetch({
              instanceIds: variables.instanceIds,
            })
          }

          return
        }

        await refetch()
      },
      [enabled, refetch, utils.activity.outdatedElementInstances]
    )

  return {
    loading: isFetching,
    outdatedInstances,
    refetch: refetchOutdatedInstances,
  }
}
