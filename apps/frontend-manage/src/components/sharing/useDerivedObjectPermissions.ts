import { useQuery } from '@apollo/client'
import {
  CatalogObjectType,
  DerivedPermissionInfo,
  GetDerivedObjectPermissionsDocument,
} from '@klicker-uzh/graphql/dist/ops'

function useDerivedObjectPermissions({
  objectId,
  objectType,
  skip,
}: {
  objectId: string | number
  objectType: CatalogObjectType
  skip: boolean
}): { derivedPermissions: DerivedPermissionInfo[]; loading: boolean } {
  const { data, loading } = useQuery(GetDerivedObjectPermissionsDocument, {
    variables: { objectId: String(objectId), objectType },
    skip,
  })

  return {
    derivedPermissions: data?.getDerivedObjectPermissions ?? [],
    loading,
  }
}

export default useDerivedObjectPermissions
