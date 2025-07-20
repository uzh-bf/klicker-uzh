import { useQuery } from '@apollo/client'
import {
  DerivedPermissionInfo,
  GetDerivedObjectPermissionsDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'

function useDerivedObjectPermissions({
  objectId,
  objectType,
  skip,
}: {
  objectId: string | number
  objectType: ObjectType
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
