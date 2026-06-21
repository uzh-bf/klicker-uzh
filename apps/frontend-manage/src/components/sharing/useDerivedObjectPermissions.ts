import type { ObjectType } from '@lib/constants/sharingEnums'
import { trpc, type RouterInputs, type RouterOutputs } from '../../lib/trpc'

type DerivedObjectPermissionsInput =
  RouterInputs['sharing']['derivedObjectPermissions']

export type DerivedPermissionInfo = NonNullable<
  RouterOutputs['sharing']['derivedObjectPermissions']['derivedObjectPermissions']
>[number]

function useDerivedObjectPermissions({
  objectId,
  objectType,
  skip,
}: {
  objectId: string | number
  objectType: ObjectType
  skip: boolean
}): {
  derivedPermissions: DerivedPermissionInfo[]
  loading: boolean
  error: boolean
} {
  const input: DerivedObjectPermissionsInput = {
    objectId: String(objectId),
    objectType:
      objectType as unknown as DerivedObjectPermissionsInput['objectType'],
  }
  const { data, isError, isLoading } =
    trpc.sharing.derivedObjectPermissions.useQuery(input, {
      enabled: !skip && Boolean(objectId),
      refetchOnMount: 'always',
    })

  return {
    derivedPermissions: data?.derivedObjectPermissions ?? [],
    loading: isLoading,
    error: isError,
  }
}

export default useDerivedObjectPermissions
