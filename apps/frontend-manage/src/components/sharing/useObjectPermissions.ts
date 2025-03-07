import { useQuery } from '@apollo/client'
import {
  CatalogObjectType,
  GetAnswerCollectionPermissionsDocument,
  GetCatalogCollectionPermissionsDocument,
  PermissionInfo,
} from '@klicker-uzh/graphql/dist/ops'

function useObjectPermissions({
  objectId,
  objectType,
  skip,
}: {
  objectId: string | number
  objectType: CatalogObjectType
  skip: boolean
}): { permissions: PermissionInfo[]; loading: boolean } {
  // query for catalog collections
  const {
    data: catalogCollectionPermissions,
    loading: catalogCollectionPermissionsLoading,
  } = useQuery(GetCatalogCollectionPermissionsDocument, {
    variables: { catalogCollectionId: objectId as string },
    skip: skip || objectType !== CatalogObjectType.CatalogCollection,
  })

  // query for answer collections
  const {
    data: answerCollectionPermissions,
    loading: answerCollectionPermissionsLoading,
  } = useQuery(GetAnswerCollectionPermissionsDocument, {
    variables: { collectionId: objectId as number },
    skip: skip || objectType !== CatalogObjectType.AnswerCollection,
  })

  if (objectType === CatalogObjectType.CatalogCollection) {
    return {
      permissions:
        catalogCollectionPermissions?.getCatalogCollectionPermissions ?? [],
      loading: catalogCollectionPermissionsLoading,
    }
  } else if (objectType === CatalogObjectType.AnswerCollection) {
    return {
      permissions:
        answerCollectionPermissions?.getAnswerCollectionPermissions ?? [],
      loading: answerCollectionPermissionsLoading,
    }
  }

  return { permissions: [], loading: false }
}

export default useObjectPermissions
