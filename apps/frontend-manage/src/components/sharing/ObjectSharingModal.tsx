import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionPermissionsTable from '../resources/answerCollections/AnswerCollectionPermissionsTable'
import GrantedPermissionsTable from './GrantedPermissionsTable'
import ObjectAccessRemovalErrorToast from './ObjectAccessRemovalErrorToast'
import ObjectAccessRemovalSuccessToast from './ObjectAccessRemovalSuccessToast'
import ObjectSharingErrorToast from './ObjectSharingErrorToast'
import ObjectSharingSuccessToast from './ObjectSharingSuccessToast'
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
}: {
  open: boolean
  onClose: () => void
  objectId: number | string
  objectType: CatalogObjectType
  objectName: string
  onOwnershipTransfer: () => void
  catalogCollectionId?: string
  isOwner: boolean
}) {
  const t = useTranslations()
  const [sharingSuccess, setSharingSuccess] = useState(false)
  const [sharingFailure, setSharingFailure] = useState(false)
  const [removalSuccess, setRemovalSuccess] = useState(false)
  const [removalFailure, setRemovalFailure] = useState(false)

  // get all permissions that have already been granted for this object
  const { permissions, loading: permissionsLoading } = useObjectPermissions({
    objectId,
    objectType,
    skip: !open,
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
          {/* // TODO: replace this through more generic component */}
          <AnswerCollectionPermissionsTable />
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
