import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import type { PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

export type ActivityAction = {
  id: string
  label: string
  icon: IconDefinition
  onClick: (e?: React.MouseEvent) => void
  data?: {
    cy?: string
  }
  disabled?: boolean
  tooltip?: string
  className?: string
}

function useAvailableActions({
  actions,
  statusActionMap,
  permissionActionMap,
  isEditor,
  isExecutor,
  isManager,
  isOwner,
  isRemovable,
  isShared,
  status,
}: {
  actions: ActivityAction[]
  statusActionMap: { [key in PublicationStatus]: string[] }
  permissionActionMap: {
    isManager: string[]
    isEditor: string[]
    isExecutor: string[]
    isShared: string[]
    isRemovable: string[]
  }
  isEditor: boolean
  isExecutor: boolean
  isManager: boolean
  isOwner: boolean
  isRemovable: boolean
  isShared: boolean
  status: PublicationStatus
}) {
  const availableActions = useMemo(
    () =>
      statusActionMap[status]
        .flatMap(
          (actionId) => actions.find((action) => action.id === actionId) ?? []
        )
        .filter((action) => {
          if (
            (isManager || isOwner) &&
            (permissionActionMap.isManager.includes(action.id) ||
              permissionActionMap.isEditor.includes(action.id) ||
              permissionActionMap.isExecutor.includes(action.id) ||
              permissionActionMap.isShared.includes(action.id))
          ) {
            return true
          } else if (
            isEditor &&
            (permissionActionMap.isEditor.includes(action.id) ||
              permissionActionMap.isExecutor.includes(action.id) ||
              permissionActionMap.isShared.includes(action.id))
          ) {
            return true
          } else if (
            isExecutor &&
            (permissionActionMap.isExecutor.includes(action.id) ||
              permissionActionMap.isShared.includes(action.id))
          ) {
            return true
          } else if (
            isShared &&
            permissionActionMap.isShared.includes(action.id)
          ) {
            return true
          } else if (
            isRemovable &&
            permissionActionMap.isRemovable.includes(action.id)
          ) {
            return true
          }
          return false
        }),
    [
      actions,
      permissionActionMap,
      statusActionMap,
      status,
      isEditor,
      isExecutor,
      isManager,
      isOwner,
      isRemovable,
      isShared,
    ]
  )

  return availableActions
}

export default useAvailableActions
