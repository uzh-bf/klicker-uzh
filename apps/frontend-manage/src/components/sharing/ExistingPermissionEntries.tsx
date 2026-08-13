import {
  ObjectType,
  PermissionInfo,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import usePermissionLevelSelection from '../../lib/hooks/usePermissionLevelSelection'
import ModifyOwnPermissionsModal from './ModifyOwnPermissionsModal'
import PermissionListEntry from './PermissionListEntry'
import PermissionRevocationModal from './PermissionRevocationModal'

function ExistingPermissionEntries({
  type,
  permissions,
  ownerPermission,
  changeLoading,
  showPropagationSetting,
  onPermissionLevelChange,
  onPermissionRemoval,
}: {
  type: ObjectType
  permissions: PermissionInfo[]
  ownerPermission?: PermissionInfo
  changeLoading: boolean
  showPropagationSetting: boolean
  onPermissionLevelChange: ({
    permissionId,
    newPermissionLevel,
    newPropagation,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
    newPropagation: boolean
  }) => Promise<void>
  onPermissionRemoval: (permissionId: number, isOwn: boolean) => Promise<void>
}) {
  const permissionLevelSelectItems = usePermissionLevelSelection({ type })
  const t = useTranslations()

  // state for managing the permission modification modal
  const [modifyOwnPermissionsModal, setModifyOwnPermissionsModal] = useState<{
    open: boolean
    permissionId?: number
    newPermissionLevel?: PermissionLevel
    newPropagation?: boolean
    action: 'change' | 'remove'
  }>({
    open: false,
    action: 'change',
  })

  // state for managing the permission revocation modal
  const [revocationModal, setRevocationModal] = useState<{
    open: boolean
    permissionId?: number
    username?: string
    userGroup?: string
  }>({
    open: false,
  })

  // handle access level change with confirmation for own permissions
  const handlePermissionLevelChange = async (
    permissionId: number,
    newPermissionLevel: PermissionLevel,
    newPropagation: boolean,
    isOwn: boolean
  ) => {
    if (isOwn) {
      setModifyOwnPermissionsModal({
        open: true,
        permissionId,
        newPermissionLevel,
        newPropagation,
        action: 'change',
      })
    } else {
      await onPermissionLevelChange({
        permissionId,
        newPermissionLevel,
        newPropagation,
      })
    }
  }

  // handle permission removal with confirmation for own permissions
  const handleRemovePermission = async (
    permissionId: number,
    isOwn: boolean,
    username?: string,
    userGroup?: string
  ) => {
    if (isOwn) {
      setModifyOwnPermissionsModal({
        open: true,
        permissionId,
        action: 'remove',
      })
    } else {
      setRevocationModal({
        open: true,
        permissionId,
        username,
        userGroup,
      })
    }
  }

  // confirm modifying own permissions
  const confirmModifyOwnPermissions = async () => {
    if (modifyOwnPermissionsModal.action === 'change') {
      await onPermissionLevelChange({
        permissionId: modifyOwnPermissionsModal.permissionId!,
        newPermissionLevel: modifyOwnPermissionsModal.newPermissionLevel!,
        newPropagation: modifyOwnPermissionsModal.newPropagation!,
      })
    } else {
      await onPermissionRemoval(modifyOwnPermissionsModal.permissionId!, true)
    }
    setModifyOwnPermissionsModal({ ...modifyOwnPermissionsModal, open: false })
  }

  // confirm permission revocation
  const confirmRevocation = async () => {
    await onPermissionRemoval(revocationModal.permissionId!, false)
  }

  return (
    <>
      {ownerPermission && (
        <PermissionListEntry
          disabled
          index={-1}
          key={`owner-permission-${ownerPermission.userId}`}
          dataPrefix="owner-"
          permission={ownerPermission}
          permissionLevelSelectItems={permissionLevelSelectItems}
          handlePermissionLevelChange={handlePermissionLevelChange}
          handleRemovePermission={handleRemovePermission}
          changeLoading={changeLoading}
          showPropagationSetting={showPropagationSetting}
        />
      )}
      {permissions
        ?.filter(
          (permission) => permission.username || permission.userGroupName
        )
        .map((permission, index) => (
          <PermissionListEntry
            key={permission.permissionId}
            index={index}
            permission={permission}
            permissionLevelSelectItems={permissionLevelSelectItems}
            handlePermissionLevelChange={handlePermissionLevelChange}
            handleRemovePermission={handleRemovePermission}
            changeLoading={changeLoading}
            showPropagationSetting={showPropagationSetting}
          />
        ))}

      {modifyOwnPermissionsModal.open && (
        <ModifyOwnPermissionsModal
          onClose={() =>
            setModifyOwnPermissionsModal({
              ...modifyOwnPermissionsModal,
              open: false,
            })
          }
          onConfirm={confirmModifyOwnPermissions}
          action={modifyOwnPermissionsModal.action}
          newPermissionLevel={modifyOwnPermissionsModal.newPermissionLevel}
        />
      )}
      {revocationModal.open && (
        <PermissionRevocationModal
          onClose={() =>
            setRevocationModal({ ...revocationModal, open: false })
          }
          onRevocation={confirmRevocation}
          username={revocationModal.username}
          userGroup={revocationModal.userGroup}
        />
      )}
    </>
  )
}

export default ExistingPermissionEntries
