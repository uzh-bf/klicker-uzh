import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import {
  ObjectType,
  PermissionLevel,
  toGraphqlObjectType,
  toGraphqlPermissionLevel,
} from '@lib/constants/catalogEnums'
import { Button, Modal, SelectField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import usePermissionLevelSelection from '../../../lib/hooks/usePermissionLevelSelection'
import { trpc, type RouterInputs, type RouterOutputs } from '../../../lib/trpc'
import PermissionsTable from '../../sharing/PermissionsTable'
import PropagatedPermissionsTable from '../../sharing/PropagatedPermissionsTable'

type ObjectSharingRequest = NonNullable<
  RouterOutputs['sharing']['catalogSharingRequests']['catalogSharingRequests']
>[number]
type ApproveObjectSharingRequestInput =
  RouterInputs['sharing']['approveObjectSharingRequest']

function SharingRequestApprovalModal({
  request,
  onClose,
  onSuccess,
}: {
  request: ObjectSharingRequest
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations()
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>(
    PermissionLevel.Read
  )
  const objectType = request.objectType as unknown as ObjectType
  const permissionLevelSelectItems = usePermissionLevelSelection({
    type: toGraphqlObjectType(objectType),
  })
  const utils = trpc.useUtils()
  const approveObjectSharingRequest =
    trpc.sharing.approveObjectSharingRequest.useMutation()

  const removeRequestFromCaches = () => {
    utils.sharing.catalogSharingRequests.setData(undefined, (queryData) => {
      if (!queryData?.catalogSharingRequests) return queryData

      return {
        catalogSharingRequests: queryData.catalogSharingRequests.filter(
          (cachedRequest) =>
            !(
              cachedRequest.requestId === request.requestId &&
              cachedRequest.userId === request.userId
            )
        ),
      }
    })

    utils.sharing.catalogSharingRequestCount.setData(undefined, (queryData) => {
      if (typeof queryData?.count !== 'number') return queryData

      return {
        count: Math.max(queryData.count - 1, 0),
      }
    })
  }

  return (
    <Modal
      open
      onClose={(e) => {
        e?.stopPropagation()
        onClose()
      }}
      title={t('manage.catalog.approveSharingRequest')}
      className={{ content: 'pb-2' }}
    >
      <div>
        {t('manage.catalog.specifyObjectPermissionLevel', {
          objectName: request.objectName,
          objectType: t(`shared.types.${objectType}`),
          userShortname: request.userShortname,
        })}
      </div>
      <SelectField
        required
        value={permissionLevel}
        label={t('shared.generic.permissionLevel')}
        items={permissionLevelSelectItems}
        onChange={(newValue) =>
          setPermissionLevel(newValue as unknown as PermissionLevel)
        }
        className={{ label: 'text-base', select: { trigger: 'h-9' } }}
        data={{ cy: 'permission-level-select' }}
      />
      <div className="mt-3 flex flex-row justify-between">
        <Button
          onClick={(e) => {
            e?.stopPropagation()
            onClose()
          }}
          className={{ root: 'h-8 border-red-600 py-0 text-base' }}
          data={{ cy: 'cancel-approval' }}
        >
          <Button.Icon icon={faBan} />
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          primary
          loading={approveObjectSharingRequest.isLoading}
          className={{ root: 'h-8 py-0' }}
          data={{ cy: 'confirm-approval' }}
          onClick={async (e) => {
            e?.stopPropagation()
            const input: ApproveObjectSharingRequestInput = {
              requestId: request.requestId,
              userId: request.userId,
              permissionLevel:
                permissionLevel as unknown as ApproveObjectSharingRequestInput['permissionLevel'],
              propagation: false, // TODO: update this value once the propagation parameter can be toggled in the UI (only relevant for courses at the moment - which cannot be requested)
            }
            const result = await approveObjectSharingRequest.mutateAsync(input)

            if (result.resolved) {
              removeRequestFromCaches()
              onSuccess()
              onClose()
            } else {
              toast({
                type: 'error',
                message: t('manage.catalog.approvalFailed'),
                options: { duration: 5000 },
              })
            }
          }}
        >
          <Button.Icon
            icon={faCheck}
            loading={approveObjectSharingRequest.isLoading}
          />
          <Button.Label>{t('shared.generic.approve')}</Button.Label>
        </Button>
      </div>

      <div className="mt-6">
        <PermissionsTable
          objectType={toGraphqlObjectType(objectType)}
          activePermissionLevel={toGraphqlPermissionLevel(permissionLevel)}
        />
      </div>

      <PropagatedPermissionsTable
        objectType={toGraphqlObjectType(objectType)}
        activePermissionLevel={toGraphqlPermissionLevel(permissionLevel)}
        showPropagationSetting={objectType === ObjectType.Course}
      />
    </Modal>
  )
}

export default SharingRequestApprovalModal
