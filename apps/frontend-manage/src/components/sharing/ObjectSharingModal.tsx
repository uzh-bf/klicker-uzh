import { faEye } from '@fortawesome/free-regular-svg-icons'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import DerivedPermissionsTable from './DerivedPermissionsTable'
import GrantedPermissionsTable from './GrantedPermissionsTable'
import PermissionsTable from './PermissionsTable'
import PropagatedPermissionsTable from './PropagatedPermissionsTable'
import useDerivedObjectPermissions from './useDerivedObjectPermissions'
import useObjectPermissions from './useObjectPermissions'
import useObjectSharing from './useObjectSharing'
import usePermissionLevelChange from './usePermissionLevelChange'
import usePermissionRevocation from './usePermissionRevocation'

function ObjectSharingModal({
  onClose,
  objectId,
  objectType,
  objectName,
  catalogCollectionId,
  onOwnershipTransfer,
  isOwner,
  derivedPermissionsAvailable,
}: {
  onClose: () => void
  objectId: number | string
  objectType: ObjectType
  objectName: string
  onOwnershipTransfer: () => void
  catalogCollectionId?: string
  isOwner: boolean
  derivedPermissionsAvailable: boolean // flag to conditionally show derived permissions (not defined for certain objects)
}) {
  const t = useTranslations()
  const [showDerivedPermissions, setShowDerivedPermissions] = useState(false)

  const onSharingSuccess = () =>
    toast({
      type: 'success',
      message: t('manage.sharing.sharingSuccessful'),
      options: { duration: 3000 },
    })

  const onSharingFailure = () =>
    toast({
      type: 'error',
      message: t('manage.sharing.sharingFailed'),
      options: { duration: 3000 },
    })

  const onRemovalFailure = () =>
    toast({
      type: 'error',
      message: t('manage.sharing.accessRemovalFailed'),
      options: { duration: 6000 },
    })

  // boolean to determine whether to show the propagation option on the permissions
  const showPropagationSetting =
    objectType === ObjectType.Course ||
    objectType === ObjectType.LiveQuiz ||
    objectType === ObjectType.PracticeQuiz ||
    objectType === ObjectType.MicroLearning ||
    objectType === ObjectType.GroupActivity

  // get all permissions that have already been granted for this object
  const { permissions, loading: permissionsLoading } = useObjectPermissions({
    objectId,
    objectType,
    skip: !open,
  })

  // get all permissions that have already been granted for this object
  const { derivedPermissions, loading: derivedPermissionsLoading } =
    useDerivedObjectPermissions({
      objectId,
      objectType,
      skip: !open || !derivedPermissionsAvailable || !showDerivedPermissions,
    })

  // mutation to change the access level of a certain permission
  const { onPermissionLevelChange, permissionChanging } =
    usePermissionLevelChange({
      objectId,
      objectType,
      catalogCollectionId,
    })

  // mutation to revoke access for a certain permission
  const { onPermissionRevocation, permissionRevoking } =
    usePermissionRevocation({
      objectId,
      objectType,
      catalogCollectionId,
      onError: () => onRemovalFailure(),
    })

  // mutation to create new permission entry for answer collection
  const { onShareObject } = useObjectSharing({
    objectId,
    objectType,
    catalogCollectionId,
    onSuccess: () => onSharingSuccess(),
    onError: () => onSharingFailure(),
  })

  return (
    <Modal
      open
      fullScreen
      title={t(`manage.sharing.share${objectType}`)}
      onClose={onClose}
      dataCloseButton={{ cy: 'close-share-object' }}
      className={{ content: 'h-max max-w-5xl pb-0' }}
    >
      <div>
        {t.rich(`manage.sharing.infoSharing${objectType}`, {
          objectName,
          b: (text) => <b>{text}</b>,
        })}
      </div>
      <div className="my-4">
        <PermissionsTable objectType={objectType} />
      </div>

      <PropagatedPermissionsTable
        objectType={objectType}
        showPropagationSetting={showPropagationSetting}
      />

      <div className="mt-8">
        <GrantedPermissionsTable
          type={objectType}
          permissions={permissions ?? []}
          permissionsLoading={permissionsLoading}
          changeLoading={permissionChanging}
          isOwner={isOwner}
          showPropagationSetting={showPropagationSetting}
          onPermissionLevelChange={async ({
            permissionId,
            newPermissionLevel,
            newPropagation,
          }) => {
            await onPermissionLevelChange({
              permissionId,
              newPermissionLevel,
              newPropagation,
            })
          }}
          onPermissionRemoval={async (permissionId) => {
            try {
              const success = await onPermissionRevocation({ permissionId })
              if (success) {
                toast({
                  type: 'success',
                  message: t('manage.sharing.accessRemovalSuccessful'),
                  options: { duration: 3000 },
                })
              } else {
                onRemovalFailure()
              }
            } catch (error) {
              onRemovalFailure()
            }
          }}
          shareObjectCallback={async (values) => await onShareObject(values)}
          onOwnershipTransfer={onOwnershipTransfer}
        />
      </div>
      {derivedPermissionsAvailable ? (
        <div className="mt-2 flex flex-col">
          {showDerivedPermissions ? (
            <div className="mt-8">
              <DerivedPermissionsTable
                derivedPermissions={derivedPermissions ?? []}
                derivedPermissionsLoading={derivedPermissionsLoading}
                setShowDerivedPermissions={setShowDerivedPermissions}
              />
            </div>
          ) : (
            <Button
              basic
              onClick={() => setShowDerivedPermissions(true)}
              className={{
                root: 'text-primary-100 hover:text-primary-100 self-end px-3 py-0.5 text-sm',
              }}
              data={{
                cy: 'show-derived-permissions',
              }}
            >
              <Button.Icon icon={faEye} />
              <Button.Label>
                {t('manage.sharing.showDerivedPermissions')}
              </Button.Label>
            </Button>
          )}
        </div>
      ) : null}
    </Modal>
  )
}

export default ObjectSharingModal
