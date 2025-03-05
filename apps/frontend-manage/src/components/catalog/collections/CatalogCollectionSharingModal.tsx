import { useMutation, useQuery } from '@apollo/client'
import {
  CatalogObjectType,
  ChangeCatalogCollectionAccessLevelDocument,
  GetCatalogCollectionInfoDocument,
  GetCatalogCollectionPermissionsDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  RevokeCatalogCollectionAccessDocument,
  ShareCatalogCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import GrantedPermissionsTable from '../../resources/sharing/GrantedPermissionsTable'
import CatalogCollectionAccessRemovalErrorToast from './CatalogCollectionAccessRemovalErrorToast'
import CatalogCollectionAccessRemovalSuccessToast from './CatalogCollectionAccessRemovalSuccessToast'
import CatalogCollectionPermissionsTable from './CatalogCollectionPermissionsTable'
import CatalogCollectionSharingErrorToast from './CatalogCollectionSharingErrorToast'
import CatalogCollectionSharingSuccessToast from './CatalogCollectionSharingSuccessToast'

function CatalogCollectionSharingModal({
  catalogCollectionId,
  catalogCollectionName,
  open,
  onClose,
  onOwnershipTransfer,
  isOwner,
}: {
  catalogCollectionId: string
  catalogCollectionName: string
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
    GetCatalogCollectionPermissionsDocument,
    {
      variables: { catalogCollectionId },
      skip: !open,
    }
  )
  const permissions = data?.getCatalogCollectionPermissions

  // mutation to create new permission entry for catalog collection
  const [shareCatalogCollection] = useMutation(ShareCatalogCollectionDocument)

  // mutation to change the access level of a certain permission
  const [changeCatalogCollectionAccessLevel, { loading: changeLoading }] =
    useMutation(ChangeCatalogCollectionAccessLevelDocument)

  // mutation to revoke access for a certain permission
  const [revokeCatalogCollectionAccess] = useMutation(
    RevokeCatalogCollectionAccessDocument
  )

  return (
    <>
      <Modal
        fullScreen
        title={t('manage.catalog.shareCatalogCollection')}
        open={open}
        onClose={onClose}
        dataCloseButton={{ cy: 'close-share-catalog-collection' }}
        className={{
          content: 'h-max max-h-full max-w-5xl',
        }}
      >
        <div>
          {t.rich('manage.catalog.infoCatalogCollectionSharing', {
            name: catalogCollectionName,
            b: (text) => <b>{text}</b>,
          })}
        </div>
        <div className="my-4">
          <CatalogCollectionPermissionsTable />
        </div>

        <div className="mt-8">
          <GrantedPermissionsTable
            type={CatalogObjectType.CatalogCollection}
            permissions={permissions ?? []}
            permissionsLoading={permissionsLoading}
            changeLoading={changeLoading}
            isOwner={isOwner}
            onAccessLevelChange={async ({ permissionId, newAccessLevel }) => {
              await changeCatalogCollectionAccessLevel({
                variables: {
                  catalogCollectionId,
                  permissionId,
                  accessLevel: newAccessLevel,
                },
                update: (cache, { data }) => {
                  if (!data?.changeCatalogCollectionAccessLevel) return

                  const prevPermissions = cache.readQuery({
                    query: GetCatalogCollectionPermissionsDocument,
                    variables: {
                      catalogCollectionId,
                    },
                  })

                  if (!prevPermissions?.getCatalogCollectionPermissions) {
                    return
                  }

                  const modifiedPermissionId =
                    data.changeCatalogCollectionAccessLevel!.permissionId
                  const newAccessLevel =
                    data.changeCatalogCollectionAccessLevel!.accessLevel
                  cache.writeQuery({
                    query: GetCatalogCollectionPermissionsDocument,
                    variables: {
                      catalogCollectionId,
                    },
                    data: {
                      getCatalogCollectionPermissions:
                        prevPermissions.getCatalogCollectionPermissions.map(
                          (permission) =>
                            permission.permissionId === modifiedPermissionId
                              ? { ...permission, accessLevel: newAccessLevel }
                              : permission
                        ),
                    },
                  })
                },
                refetchQueries: [
                  {
                    query: GetCatalogCollectionInfoDocument,
                    variables: { catalogCollectionId },
                  },
                  {
                    query: GetCatalogObjectsDocument,
                    variables: { catalogCollectionId },
                  },
                  GetCatalogSharingRequestsDocument,
                ],
              })
            }}
            onPermissionRemoval={async (permissionId) => {
              try {
                const result = await revokeCatalogCollectionAccess({
                  variables: {
                    catalogCollectionId,
                    permissionId,
                  },
                  update: (cache, { data }) => {
                    const prevPermissions = cache.readQuery({
                      query: GetCatalogCollectionPermissionsDocument,
                      variables: {
                        catalogCollectionId,
                      },
                    })

                    const removedId = data?.revokeCatalogCollectionAccess
                    if (
                      !prevPermissions?.getCatalogCollectionPermissions ||
                      typeof removedId === 'undefined'
                    ) {
                      return
                    }

                    cache.writeQuery({
                      query: GetCatalogCollectionPermissionsDocument,
                      variables: {
                        catalogCollectionId,
                      },
                      data: {
                        getCatalogCollectionPermissions:
                          prevPermissions.getCatalogCollectionPermissions.filter(
                            (permission) =>
                              permission.permissionId !== removedId
                          ),
                      },
                    })
                  },
                  refetchQueries: [
                    {
                      query: GetCatalogCollectionInfoDocument,
                      variables: { catalogCollectionId },
                    },
                    {
                      query: GetCatalogObjectsDocument,
                      variables: { catalogCollectionId },
                    },
                    GetCatalogSharingRequestsDocument,
                  ],
                })

                if (result.data?.revokeCatalogCollectionAccess) {
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
              const newPermission = await shareCatalogCollection({
                variables: {
                  catalogCollectionId,
                  usernameOrEmail: values.usernameOrEmail,
                  userGroupId:
                    typeof values.usernameOrEmail === 'undefined'
                      ? values.userGroupId
                      : undefined,
                  accessLevel: values.accessLevel,
                },
                update: (cache, { data }) => {
                  if (!data?.shareCatalogCollection) return

                  const prevPermissions = cache.readQuery({
                    query: GetCatalogCollectionPermissionsDocument,
                    variables: {
                      catalogCollectionId,
                    },
                  })

                  if (!prevPermissions?.getCatalogCollectionPermissions) {
                    return
                  }

                  // replace the permission that was just added (if it already exists) and add it otherwise
                  const newPermissions =
                    prevPermissions.getCatalogCollectionPermissions.filter(
                      (permission) =>
                        permission.permissionId !==
                        data.shareCatalogCollection!.permissionId
                    )
                  newPermissions.push(data.shareCatalogCollection)

                  cache.writeQuery({
                    query: GetCatalogCollectionPermissionsDocument,
                    variables: {
                      catalogCollectionId,
                    },
                    data: {
                      getCatalogCollectionPermissions: newPermissions,
                    },
                  })
                },
                refetchQueries: [
                  {
                    query: GetCatalogCollectionInfoDocument,
                    variables: { catalogCollectionId },
                  },
                  {
                    query: GetCatalogObjectsDocument,
                    variables: { catalogCollectionId },
                  },
                  GetCatalogSharingRequestsDocument,
                ],
              })

              return (
                typeof newPermission.data?.shareCatalogCollection
                  ?.permissionId !== 'undefined'
              )
            }}
          />
        </div>
      </Modal>
      <CatalogCollectionSharingSuccessToast
        open={sharingSuccess}
        onClose={() => setSharingSuccess(false)}
      />
      <CatalogCollectionSharingErrorToast
        open={sharingFailure}
        onClose={() => setSharingFailure(false)}
      />
      <CatalogCollectionAccessRemovalSuccessToast
        open={removalSuccess}
        onClose={() => setRemovalSuccess(false)}
      />
      <CatalogCollectionAccessRemovalErrorToast
        open={removalFailure}
        onClose={() => setRemovalFailure(false)}
      />
    </>
  )
}

export default CatalogCollectionSharingModal
