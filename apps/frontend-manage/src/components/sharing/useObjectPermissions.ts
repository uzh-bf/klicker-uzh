import { useQuery } from '@apollo/client'
import {
  CatalogObjectType,
  GetAnswerCollectionPermissionsDocument,
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
  const {
    data: answerCollectionPermissions,
    loading: answerCollectionPermissionsLoading,
  } = useQuery(GetAnswerCollectionPermissionsDocument, {
    variables: { collectionId: objectId as number },
    skip: skip || objectType !== CatalogObjectType.AnswerCollection,
  })

  if (objectType === CatalogObjectType.AnswerCollection) {
    return {
      permissions:
        answerCollectionPermissions?.getAnswerCollectionPermissions ?? [],
      loading: answerCollectionPermissionsLoading,
    }
  }

  return { permissions: [], loading: false }
}

export default useObjectPermissions
