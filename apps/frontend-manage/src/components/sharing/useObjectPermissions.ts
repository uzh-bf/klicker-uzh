import { useQuery } from '@apollo/client'
import {
  CatalogObjectType,
  GetObjectPermissionsDocument,
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
  const { data, loading } = useQuery(GetObjectPermissionsDocument, {
    variables: { objectId: String(objectId), objectType },
    skip,
  })

  return { permissions: data?.getObjectPermissions ?? [], loading }
}

export default useObjectPermissions
