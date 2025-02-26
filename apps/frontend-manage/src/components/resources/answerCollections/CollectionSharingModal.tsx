import { useMutation, useQuery } from '@apollo/client'
import {
  AnswerCollection,
  CatalogObjectType,
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
}: {
  collection: AnswerCollection
  open: boolean
  onClose: () => void
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

  return (
    <>
      <Modal
        fullScreen
        title={t('manage.resources.shareAnswerCollection')}
        open={open}
        onClose={onClose}
        dataCloseButton={{ cy: 'close-remove-answer-collection' }}
        className={{
          content: 'max-w-5xl',
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
            onAccessLevelChange={async () => {}} // TODO: implement mutation
            onPermissionRemoval={async () => {}} // TODO: implement mutation
            onNewPermissionSuccess={() => setSharingSuccess(true)}
            onNewPermissionFailure={() => setSharingFailure(true)}
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

                  if (
                    !prevPermissions?.getAnswerCollectionPermissions ||
                    !data.shareAnswerCollection
                  ) {
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
