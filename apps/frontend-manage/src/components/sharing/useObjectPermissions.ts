import { useQuery } from '@apollo/client'
import {
  GetObjectPermissionsDocument,
  ObjectType,
  PermissionInfo,
} from '@klicker-uzh/graphql/dist/ops'

function useObjectPermissions({
  objectId,
  objectType,
  skip,
}: {
  objectId: string | number
  objectType: ObjectType
  skip: boolean
}): { permissions: PermissionInfo[]; isOwner: boolean; loading: boolean } {
  const { data, loading } = useQuery(GetObjectPermissionsDocument, {
    variables: { objectId: String(objectId), objectType },
    skip,
    fetchPolicy: 'cache-and-network',
  })

  return {
    permissions: data?.getObjectPermissions?.permissions ?? [],
    isOwner: data?.getObjectPermissions?.isOwner ?? false,
    loading,
  }
}

export default useObjectPermissions
