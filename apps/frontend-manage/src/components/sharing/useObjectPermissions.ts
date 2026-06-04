import type { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { trpc, type RouterInputs, type RouterOutputs } from '../../lib/trpc'

type ObjectPermissionsInput = RouterInputs['sharing']['objectPermissions']

export type PermissionInfo = NonNullable<
  RouterOutputs['sharing']['objectPermissions']['objectPermissions']
>['permissions'][number]

function useObjectPermissions({
  objectId,
  objectType,
  skip,
}: {
  objectId: string | number
  objectType: ObjectType
  skip: boolean
}): {
  permissions: PermissionInfo[]
  ownerPermission?: PermissionInfo
  isOwner: boolean
  loading: boolean
} {
  const input: ObjectPermissionsInput = {
    objectId: String(objectId),
    objectType: objectType as unknown as ObjectPermissionsInput['objectType'],
  }
  const { data, isLoading } = trpc.sharing.objectPermissions.useQuery(input, {
    enabled: !skip && Boolean(objectId),
    refetchOnMount: 'always',
  })

  return {
    permissions: data?.objectPermissions?.permissions ?? [],
    ownerPermission: data?.objectPermissions?.ownerPermission ?? undefined,
    isOwner: data?.objectPermissions?.isOwner ?? false,
    loading: isLoading,
  }
}

export default useObjectPermissions
