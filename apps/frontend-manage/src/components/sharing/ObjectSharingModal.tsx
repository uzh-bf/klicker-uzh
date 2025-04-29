import { faEye } from '@fortawesome/free-regular-svg-icons'
import { SharingObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import DerivedPermissionsTable from './DerivedPermissionsTable'
import GrantedPermissionsTable from './GrantedPermissionsTable'
import ObjectAccessRemovalErrorToast from './ObjectAccessRemovalErrorToast'
import ObjectAccessRemovalSuccessToast from './ObjectAccessRemovalSuccessToast'
import ObjectSharingErrorToast from './ObjectSharingErrorToast'
import ObjectSharingSuccessToast from './ObjectSharingSuccessToast'
import PermissionsTable from './PermissionsTable'
import useDerivedObjectPermissions from './useDerivedObjectPermissions'
import useObjectPermissions from './useObjectPermissions'
import useObjectSharing from './useObjectSharing'
import usePermissionLevelChange from './usePermissionLevelChange'
import usePermissionRevocation from './usePermissionRevocation'

function ObjectSharingModal({
  open,
  onClose,
  objectId,
  objectType,
  objectName,
  catalogCollectionId,
  onOwnershipTransfer,
  isOwner,
  derivedPermissionsAvailable,
}: {
  open: boolean
  onClose: () => void
  objectId: number | string
  objectType: SharingObjectType
  objectName: string
  onOwnershipTransfer: () => void
  catalogCollectionId?: string
  isOwner: boolean
  derivedPermissionsAvailable: boolean // flag to conditionally show derived permissions (not defined for certain objects)
}) {
  const t = useTranslations()
  const [sharingSuccess, setSharingSuccess] = useState(false)
  const [sharingFailure, setSharingFailure] = useState(false)
  const [removalSuccess, setRemovalSuccess] = useState(false)
  const [removalFailure, setRemovalFailure] = useState(false)
  const [showDerivedPermissions, setShowDerivedPermissions] = useState(false)

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
      onError: () => setRemovalFailure(true),
    })

  // mutation to create new permission entry for answer collection
  const { onShareObject, objectSharing } = useObjectSharing({
    objectId,
    objectType,
    catalogCollectionId,
    onError: () => setSharingFailure(true),
  })

  return (
    <>
      <Modal
        fullScreen
        title={t(`manage.sharing.share${objectType}`)}
        open={open}
        onClose={onClose}
        dataCloseButton={{ cy: 'close-share-object' }}
        className={{
          content: 'h-max max-h-full max-w-5xl',
        }}
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

        <div className="mt-8">
          <GrantedPermissionsTable
            type={objectType}
            permissions={permissions ?? []}
            permissionsLoading={permissionsLoading}
            changeLoading={permissionChanging}
            isOwner={isOwner}
            onPermissionLevelChange={async ({
              permissionId,
              newPermissionLevel,
            }) => {
              const success = await onPermissionLevelChange({
                permissionId,
                newPermissionLevel,
              })
            }}
            onPermissionRemoval={async (permissionId) => {
              try {
                const success = await onPermissionRevocation({ permissionId })
                if (success) {
                  setRemovalSuccess(true)
                } else {
                  setRemovalFailure(true)
                }
              } catch (error) {
                setRemovalFailure(true)
              }
            }}
            shareObjectCallback={async (values) => await onShareObject(values)}
            onSharingSuccess={() => setSharingSuccess(true)}
            onSharingFailure={() => setSharingFailure(true)}
            onOwnershipTransfer={onOwnershipTransfer}
          />
        </div>
        {derivedPermissionsAvailable ? (
          <div className="mt-2">
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
                  root: 'text-primary-100 hover:text-primary-100 float-right px-3 py-0.5 text-sm',
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

      <ObjectSharingSuccessToast
        open={sharingSuccess}
        onClose={() => setSharingSuccess(false)}
      />
      <ObjectSharingErrorToast
        open={sharingFailure}
        onClose={() => setSharingFailure(false)}
      />
      <ObjectAccessRemovalSuccessToast
        open={removalSuccess}
        onClose={() => setRemovalSuccess(false)}
      />
      <ObjectAccessRemovalErrorToast
        open={removalFailure}
        onClose={() => setRemovalFailure(false)}
      />
    </>
  )
}

export default ObjectSharingModal
