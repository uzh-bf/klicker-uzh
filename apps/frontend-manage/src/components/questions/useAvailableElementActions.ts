import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
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
  className?: string
}

function useAvailableElementActions({
  actions,
  permissionActionMap,
  isEditor,
  isManager,
  isOwner,
  isRemovable,
  isShared,
}: {
  actions: ActivityAction[]
  permissionActionMap: {
    isManager: string[]
    isEditor: string[]
    isShared: string[]
    isRemovable: string[]
  }
  isEditor: boolean
  isManager: boolean
  isOwner: boolean
  isRemovable: boolean
  isShared: boolean
}) {
  const availableActions = useMemo(
    () =>
      actions.filter((action) => {
        if (
          (isManager || isOwner) &&
          (permissionActionMap.isManager.includes(action.id) ||
            permissionActionMap.isEditor.includes(action.id) ||
            permissionActionMap.isShared.includes(action.id))
        ) {
          return true
        } else if (
          isEditor &&
          (permissionActionMap.isEditor.includes(action.id) ||
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
      isEditor,
      isManager,
      isOwner,
      isRemovable,
      isShared,
    ]
  )

  return availableActions
}

export default useAvailableElementActions
