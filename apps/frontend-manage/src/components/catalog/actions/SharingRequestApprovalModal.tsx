import { useMutation } from '@apollo/client'
import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import {
  ApproveObjectSharingRequestDocument,
  CountCatalogSharingRequestsDocument,
  GetCatalogSharingRequestsDocument,
  ObjectSharingRequest,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, SelectField, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import usePermissionLevelSelection from '../../../lib/hooks/usePermissionLevelSelection'
import PermissionsTable from '../../sharing/PermissionsTable'

function SharingRequestApprovalModal({
  request,
  open,
  onClose,
  onSuccess,
}: {
  request: ObjectSharingRequest
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations()
  const [permissionLevel, setPermissionLevel] = useState(PermissionLevel.Read)
  const [errorToast, setErrorToast] = useState(false)

  const permissionLevelSelectItems = usePermissionLevelSelection({
    type: request.objectType,
  })

  const [approveObjectSharingRequest, { loading: approvalLoading }] =
    useMutation(ApproveObjectSharingRequestDocument)

  return (
    <Modal
      open={open}
      onClose={(e) => {
        e?.stopPropagation()
        onClose()
      }}
      title={t('manage.catalog.approveSharingRequest')}
    >
      <div>
        {t('manage.catalog.specifyObjectPermissionLevel', {
          objectName: request.objectName,
          objectType: t(`shared.types.${request.objectType}`),
          userShortname: request.userShortname,
        })}
      </div>
      <SelectField
        required
        value={permissionLevel}
        label={t('shared.generic.permissionLevel')}
        items={permissionLevelSelectItems}
        onChange={(newValue) => setPermissionLevel(newValue as PermissionLevel)}
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
          loading={approvalLoading}
          className={{ root: 'h-8 py-0' }}
          data={{ cy: 'confirm-approval' }}
          onClick={async (e) => {
            e?.stopPropagation()
            const result = await approveObjectSharingRequest({
              variables: {
                requestId: request.requestId,
                userId: request.userId,
                permissionLevel,
                propagation: false, // TODO: update this parameter based on user input
              },
              optimisticResponse: {
                approveObjectSharingRequest: true,
              },
              update: (cache, { data }) => {
                if (!data?.approveObjectSharingRequest) return

                const queryData = cache.readQuery({
                  query: GetCatalogSharingRequestsDocument,
                })
                const previousRequests = queryData?.getCatalogSharingRequests

                const queryData2 = cache.readQuery({
                  query: CountCatalogSharingRequestsDocument,
                })
                const requestsCount = queryData2?.countCatalogSharingRequests

                if (!previousRequests && !requestsCount) return

                if (previousRequests) {
                  cache.writeQuery({
                    query: GetCatalogSharingRequestsDocument,
                    data: {
                      getCatalogSharingRequests: previousRequests.filter(
                        (r) =>
                          !(
                            r.requestId === request.requestId &&
                            r.userId === request.userId
                          )
                      ),
                    },
                  })
                }

                if (requestsCount) {
                  cache.writeQuery({
                    query: CountCatalogSharingRequestsDocument,
                    data: {
                      countCatalogSharingRequests: Math.max(
                        requestsCount - 1,
                        0
                      ),
                    },
                  })
                }
              },
            })

            if (result) {
              onSuccess()
              onClose()
            } else {
              setErrorToast(true)
            }
          }}
        >
          <Button.Icon icon={faCheck} loading={approvalLoading} />
          <Button.Label>{t('shared.generic.approve')}</Button.Label>
        </Button>
      </div>

      <div className="mt-6">
        <PermissionsTable
          objectType={request.objectType}
          activePermissionLevel={permissionLevel}
        />
      </div>

      <Toast
        dismissible
        type="error"
        duration={5000}
        openExternal={errorToast}
        onCloseExternal={() => setErrorToast(false)}
        className={{ root: 'max-w-[30rem]' }}
      >
        {t('manage.catalog.approvalFailed')}
      </Toast>
    </Modal>
  )
}

export default SharingRequestApprovalModal
