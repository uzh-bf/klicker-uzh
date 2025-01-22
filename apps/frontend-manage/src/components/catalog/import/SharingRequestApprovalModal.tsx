import { useMutation } from '@apollo/client'
import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AccessLevel,
  ApproveObjectSharingRequestDocument,
  CountCatalogSharingRequestsDocument,
  GetCatalogSharingRequestsDocument,
  ObjectSharingRequest,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, SelectField, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

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
  const [accessLevel, setAccessLevel] = useState(AccessLevel.Read)
  const [errorToast, setErrorToast] = useState(false)

  const [approveObjectSharingRequest, { loading: approvaLoading }] =
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
        {t('manage.catalog.specifyAccessLevel', {
          objectName: request.objectName,
          objectType: t(`manage.catalog.objectType${request.objectType}`),
          userShortname: request.userShortname,
        })}
      </div>
      <SelectField
        required
        value={accessLevel}
        label={t('manage.catalog.accessLevel')}
        items={[
          {
            label: t(`manage.catalog.accessLevel${AccessLevel.Read}`),
            value: AccessLevel.Read,
            data: { cy: 'access-level-read' },
          },
          // {
          //   label: t(`manage.catalog.accessLevel${AccessLevel.Write}`),
          //   value: AccessLevel.Write,
          //   data: { cy: 'access-level-write' },
          // },
        ]}
        onChange={(newValue) => setAccessLevel(newValue as AccessLevel)}
        className={{ label: 'text-base' }}
        data={{ cy: 'access-level-select' }}
      />
      <div className="mt-2 flex flex-row justify-between">
        <Button
          onClick={(e) => {
            e?.stopPropagation()
            onClose()
          }}
          className={{ root: 'border-red-600 text-base' }}
          data={{ cy: 'cancel-approval' }}
        >
          <FontAwesomeIcon icon={faBan} />
          <div>{t('shared.generic.cancel')}</div>
        </Button>
        <Button
          loading={approvaLoading}
          className={{ root: 'border-green-600 text-base' }}
          data={{ cy: 'confirm-approval' }}
          onClick={async (e) => {
            e?.stopPropagation()
            const result = await approveObjectSharingRequest({
              variables: {
                permissionId: request.permissionId,
                userId: request.userId,
                accessLevel,
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
                            r.permissionId === request.permissionId &&
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
          <FontAwesomeIcon icon={faCheck} />
          <div>{t('shared.generic.approve')}</div>
        </Button>
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
