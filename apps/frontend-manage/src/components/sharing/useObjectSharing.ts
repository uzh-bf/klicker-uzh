import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  GetAnswerCollectionPermissionsDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  PermissionLevel,
  ShareAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to revoke the permission for a certain object
function useObjectSharing({
  objectId,
  objectType,
  catalogCollectionId,
  onError,
}: {
  objectId: string | number
  objectType: CatalogObjectType
  catalogCollectionId?: string
  onError: () => void
}): {
  onShareObject: ({
    usernameOrEmail,
    userGroupId,
    permissionLevel,
  }: {
    usernameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
  }) => Promise<boolean>
  objectSharing: boolean
} {
  const [shareAnswerCollection, { loading: sharingAnswerCollection }] =
    useMutation(ShareAnswerCollectionDocument)

  if (objectType === CatalogObjectType.CatalogCollection) {
    // TODO: implement
    return {
      onShareObject: async () => {
        console.error('Unsupported object type', objectType)
        onError()
        return false
      },
      objectSharing: false,
    }
  } else if (objectType === CatalogObjectType.AnswerCollection) {
    const onShareAnswerCollection = async ({
      usernameOrEmail,
      userGroupId,
      permissionLevel,
    }: {
      usernameOrEmail?: string
      userGroupId?: number
      permissionLevel: PermissionLevel
    }) => {
      try {
        const res = await shareAnswerCollection({
          variables: {
            collectionId: objectId as number,
            usernameOrEmail: usernameOrEmail,
            userGroupId:
              typeof usernameOrEmail === 'undefined' ? userGroupId : undefined,
            permissionLevel: permissionLevel,
          },
          update: (cache, { data }) => {
            if (!data?.shareAnswerCollection) return

            const prevPermissions = cache.readQuery({
              query: GetAnswerCollectionPermissionsDocument,
              variables: {
                collectionId: objectId as number,
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
                collectionId: objectId as number,
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

        if (
          typeof res?.data?.shareAnswerCollection?.permissionId !== 'undefined'
        ) {
          return true
        } else {
          return false
        }
      } catch (error) {
        console.error(error)
        onError()
        return false
      }
    }

    return {
      onShareObject: onShareAnswerCollection,
      objectSharing: sharingAnswerCollection,
    }
  }

  return {
    onShareObject: async () => {
      console.error('Unsupported object type', objectType)
      onError()
      return false
    },
    objectSharing: false,
  }
}

export default useObjectSharing
