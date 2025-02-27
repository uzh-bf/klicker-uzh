import { useMutation, useQuery } from '@apollo/client'
import {
  AnswerCollection,
  CatalogObjectType,
  ChangeCollectionAccessLevelDocument,
  GetAnswerCollectionPermissionsDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogSharingRequestsDocument,
  ShareAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CollectionSharingErrorToast from '../sharing/CollectionSharingErrorToast'
import CollectionSharingSuccessToast from '../sharing/CollectionSharingSuccessToast'
import GrantedPermissionsTable from '../sharing/GrantedPermissionsTable'
import AnswerCollectionPermissionsTable from './AnswerCollectionPermissionsTable'

function CollectionSharingModal({
  collection,
  open,
  onClose,
  onOwnershipTransfer,
  isOwner,
}: {
  collection: AnswerCollection
  open: boolean
  onClose: () => void
  onOwnershipTransfer: () => void
  isOwner: boolean
}) {
  const t = useTranslations()
  const [sharingSuccess, setSharingSuccess] = useState(false)
  const [sharingFailure, setSharingFailure] = useState(false)

  // get all permissions that have already been granted for this collection
  const { data, loading: permissionsLoading } = useQuery(
    GetAnswerCollectionPermissionsDocument,
    {
      variables: { collectionId: collection.id },
      skip: !open,
    }
  )
  const permissions = data?.getAnswerCollectionPermissions

  // mutation to create new permission entry for answer collection
  const [shareAnswerCollection] = useMutation(ShareAnswerCollectionDocument)

  // mutation to change the access level of a certain permission
  const [changeCollectionAccessLevel, { loading: changeLoading }] = useMutation(
    ChangeCollectionAccessLevelDocument
  )

  return (
    <>
      <Modal
        fullScreen
        title={t('manage.resources.shareAnswerCollection')}
        open={open}
        onClose={onClose}
        dataCloseButton={{ cy: 'close-remove-answer-collection' }}
        className={{
          content: 'h-max max-h-full max-w-5xl',
        }}
      >
        <div>
          {t.rich('manage.resources.infoCollectionSharing', {
            name: collection.name,
            b: (text) => <b>{text}</b>,
          })}
        </div>
        <div className="my-4">
          <AnswerCollectionPermissionsTable />
        </div>

        <div className="mt-8">
          <GrantedPermissionsTable
            type={CatalogObjectType.AnswerCollection}
            permissions={permissions ?? []}
            permissionsLoading={permissionsLoading}
            changeLoading={changeLoading}
            isOwner={isOwner}
            onAccessLevelChange={async ({ permissionId, newAccessLevel }) => {
              await changeCollectionAccessLevel({
                variables: {
                  collectionId: collection.id,
                  permissionId,
                  accessLevel: newAccessLevel,
                },
                update: (cache, { data }) => {
                  if (!data?.changeCollectionAccessLevel) return

                  const prevPermissions = cache.readQuery({
                    query: GetAnswerCollectionPermissionsDocument,
                    variables: {
                      collectionId: collection.id,
                    },
                  })

                  if (!prevPermissions?.getAnswerCollectionPermissions) {
                    return
                  }

                  cache.writeQuery({
                    query: GetAnswerCollectionPermissionsDocument,
                    variables: {
                      collectionId: collection.id,
                    },
                    data: {
                      getAnswerCollectionPermissions:
                        prevPermissions.getAnswerCollectionPermissions.map(
                          (permission) =>
                            permission.permissionId === permissionId
                              ? data.changeCollectionAccessLevel!
                              : permission
                        ),
                    },
                  })
                },
                refetchQueries: [
                  GetAnswerCollectionsInfoDocument,
                  GetCatalogSharingRequestsDocument,
                ],
              })
            }}
            onPermissionRemoval={async () => {}} // TODO: implement mutation
            onNewPermissionSuccess={() => setSharingSuccess(true)}
            onNewPermissionFailure={() => setSharingFailure(true)}
            onOwnershipTransfer={onOwnershipTransfer}
            shareObjectCallback={async (values) => {
              const newPermission = await shareAnswerCollection({
                variables: {
                  collectionId: collection.id,
                  usernameOrEmail: values.usernameOrEmail,
                  userGroupId:
                    typeof values.usernameOrEmail === 'undefined'
                      ? values.userGroupId
                      : undefined,
                  accessLevel: values.accessLevel,
                },
                update: (cache, { data }) => {
                  if (!data?.shareAnswerCollection) return

                  const prevPermissions = cache.readQuery({
                    query: GetAnswerCollectionPermissionsDocument,
                    variables: {
                      collectionId: collection.id,
                    },
                  })

                  if (!prevPermissions?.getAnswerCollectionPermissions) {
                    return
                  }

                  // replace the permission that was just added (if it already exists) and add it otherwise
                  const newPermissions =
                    prevPermissions.getAnswerCollectionPermissions.filter(
                      (permission) =>
                        permission.permissionId !==
                        data.shareAnswerCollection!.permissionId
                    )
                  newPermissions.push(data.shareAnswerCollection)

                  cache.writeQuery({
                    query: GetAnswerCollectionPermissionsDocument,
                    variables: {
                      collectionId: collection.id,
                    },
                    data: {
                      getAnswerCollectionPermissions: newPermissions,
                    },
                  })
                },
                refetchQueries: [
                  GetAnswerCollectionsInfoDocument,
                  GetCatalogSharingRequestsDocument,
                ],
              })

              return (
                typeof newPermission.data?.shareAnswerCollection
                  ?.permissionId !== 'undefined'
              )
            }}
          />
        </div>
      </Modal>
      <CollectionSharingSuccessToast
        open={sharingSuccess}
        onClose={() => setSharingSuccess(false)}
      />
      <CollectionSharingErrorToast
        open={sharingFailure}
        onClose={() => setSharingFailure(false)}
      />
    </>
  )
}

export default CollectionSharingModal
