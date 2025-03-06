import { useMutation, useQuery } from '@apollo/client'
import {
  CatalogObjectType,
  ChangeCollectionPermissionLevelDocument,
  GetAnswerCollectionPermissionsDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  RevokeCollectionAccessDocument,
  ShareAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CollectionAccessRemovalErrorToast from '../sharing/CollectionAccessRemovalErrorToast'
import CollectionAccessRemovalSuccessToast from '../sharing/CollectionAccessRemovalSuccessToast'
import CollectionSharingErrorToast from '../sharing/CollectionSharingErrorToast'
import CollectionSharingSuccessToast from '../sharing/CollectionSharingSuccessToast'
import GrantedPermissionsTable from '../sharing/GrantedPermissionsTable'
import AnswerCollectionPermissionsTable from './AnswerCollectionPermissionsTable'

function AnswerCollectionSharingModal({
  collectionId,
  collectionName,
  catalogCollectionId,
  open,
  onClose,
  onOwnershipTransfer,
  isOwner,
}: {
  collectionId: number
  collectionName: string
  catalogCollectionId?: string
  open: boolean
  onClose: () => void
  onOwnershipTransfer: () => void
  isOwner: boolean
}) {
  const t = useTranslations()
  const [sharingSuccess, setSharingSuccess] = useState(false)
  const [sharingFailure, setSharingFailure] = useState(false)
  const [removalSuccess, setRemovalSuccess] = useState(false)
  const [removalFailure, setRemovalFailure] = useState(false)

  // get all permissions that have already been granted for this collection
  const { data, loading: permissionsLoading } = useQuery(
    GetAnswerCollectionPermissionsDocument,
    {
      variables: { collectionId: collectionId },
      skip: !open,
    }
  )
  const permissions = data?.getAnswerCollectionPermissions

  // mutation to create new permission entry for answer collection
  const [shareAnswerCollection] = useMutation(ShareAnswerCollectionDocument)

  // mutation to change the access level of a certain permission
  const [changeCollectionPermissionLevel, { loading: changeLoading }] =
    useMutation(ChangeCollectionPermissionLevelDocument)

  // mutation to revoke access for a certain permission
  const [revokeCollectionAccess] = useMutation(RevokeCollectionAccessDocument)

  return (
    <>
      <Modal
        fullScreen
        title={t('manage.resources.shareAnswerCollection')}
        open={open}
        onClose={onClose}
        dataCloseButton={{ cy: 'close-share-answer-collection' }}
        className={{
          content: 'h-max max-h-full max-w-5xl',
        }}
      >
        <div>
          {t.rich('manage.resources.infoCollectionSharing', {
            name: collectionName,
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
            onPermissionLevelChange={async ({
              permissionId,
              newPermissionLevel,
            }) => {
              await changeCollectionPermissionLevel({
                variables: {
                  collectionId: collectionId,
                  permissionId,
                  permissionLevel: newPermissionLevel,
                },
                update: (cache, { data }) => {
                  if (!data?.changeCollectionPermissionLevel) return

                  const prevPermissions = cache.readQuery({
                    query: GetAnswerCollectionPermissionsDocument,
                    variables: {
                      collectionId: collectionId,
                    },
                  })

                  if (!prevPermissions?.getAnswerCollectionPermissions) {
                    return
                  }

                  const modifiedPermissionId =
                    data.changeCollectionPermissionLevel!.permissionId
                  const newPermissionLevel =
                    data.changeCollectionPermissionLevel!.permissionLevel
                  cache.writeQuery({
                    query: GetAnswerCollectionPermissionsDocument,
                    variables: {
                      collectionId: collectionId,
                    },
                    data: {
                      getAnswerCollectionPermissions:
                        prevPermissions.getAnswerCollectionPermissions.map(
                          (permission) =>
                            permission.permissionId === modifiedPermissionId
                              ? {
                                  ...permission,
                                  permissionLevel: newPermissionLevel,
                                }
                              : permission
                        ),
                    },
                  })
                },
                refetchQueries: [
                  GetAnswerCollectionsInfoDocument,
                  GetCatalogSharingRequestsDocument,
                  {
                    query: GetCatalogObjectsDocument,
                    variables: { catalogCollectionId },
                  },
                ],
              })
            }}
            onPermissionRemoval={async (permissionId) => {
              try {
                const result = await revokeCollectionAccess({
                  variables: {
                    collectionId: collectionId,
                    permissionId,
                  },
                  update: (cache, { data }) => {
                    const prevPermissions = cache.readQuery({
                      query: GetAnswerCollectionPermissionsDocument,
                      variables: {
                        collectionId: collectionId,
                      },
                    })

                    const removedId = data?.revokeCollectionAccess
                    if (
                      !prevPermissions?.getAnswerCollectionPermissions ||
                      typeof removedId === 'undefined'
                    ) {
                      return
                    }

                    cache.writeQuery({
                      query: GetAnswerCollectionPermissionsDocument,
                      variables: {
                        collectionId: collectionId,
                      },
                      data: {
                        getAnswerCollectionPermissions:
                          prevPermissions.getAnswerCollectionPermissions.filter(
                            (permission) =>
                              permission.permissionId !== removedId
                          ),
                      },
                    })
                  },
                  refetchQueries: [
                    GetAnswerCollectionsInfoDocument,
                    GetCatalogSharingRequestsDocument,
                    {
                      query: GetCatalogObjectsDocument,
                      variables: { catalogCollectionId },
                    },
                  ],
                })

                if (result.data?.revokeCollectionAccess) {
                  setRemovalSuccess(true)
                } else {
                  setRemovalFailure(true)
                }
              } catch (error) {
                setRemovalFailure(true)
              }
            }}
            onNewPermissionSuccess={() => setSharingSuccess(true)}
            onNewPermissionFailure={() => setSharingFailure(true)}
            onOwnershipTransfer={onOwnershipTransfer}
            shareObjectCallback={async (values) => {
              const newPermission = await shareAnswerCollection({
                variables: {
                  collectionId: collectionId,
                  usernameOrEmail: values.usernameOrEmail,
                  userGroupId:
                    typeof values.usernameOrEmail === 'undefined'
                      ? values.userGroupId
                      : undefined,
                  permissionLevel: values.permissionLevel,
                },
                update: (cache, { data }) => {
                  if (!data?.shareAnswerCollection) return

                  const prevPermissions = cache.readQuery({
                    query: GetAnswerCollectionPermissionsDocument,
                    variables: {
                      collectionId: collectionId,
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
                      collectionId: collectionId,
                    },
                    data: {
                      getAnswerCollectionPermissions: newPermissions,
                    },
                  })
                },
                refetchQueries: [
                  GetAnswerCollectionsInfoDocument,
                  GetCatalogSharingRequestsDocument,
                  {
                    query: GetCatalogObjectsDocument,
                    variables: { catalogCollectionId },
                  },
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
      <CollectionAccessRemovalSuccessToast
        open={removalSuccess}
        onClose={() => setRemovalSuccess(false)}
      />
      <CollectionAccessRemovalErrorToast
        open={removalFailure}
        onClose={() => setRemovalFailure(false)}
      />
    </>
  )
}

export default AnswerCollectionSharingModal
