import { useMutation } from '@apollo/client'
import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CountCatalogSharingRequestsDocument,
  DeclineObjectSharingRequestDocument,
  GetCatalogSharingRequestsDocument,
  ObjectSharingRequest,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import SharingRequestApprovalModal from './SharingRequestApprovalModal'

function CatalogSharingRequest({
  request,
  setDeclineSuccessful,
  setDeclineFailure,
  setApprovalSuccessful,
}: {
  request: ObjectSharingRequest
  setDeclineSuccessful: Dispatch<SetStateAction<boolean>>
  setDeclineFailure: Dispatch<SetStateAction<boolean>>
  setApprovalSuccessful: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [approvalModal, setApprovalModal] = useState(false)
  const [declineObjectSharingRequest, { loading: declineLoading }] =
    useMutation(DeclineObjectSharingRequestDocument)

  return (
    <div
      key={`sharing-request-${request.permissionId}`}
      className="flex flex-row items-center justify-between border-b py-1 text-sm"
      data-cy={`sharing-request-${request.objectName}-${request.userShortname}`}
    >
      <div>
        <div className="flex flex-row items-center gap-4">
          <div className="-mb-0.5 font-bold">{request.objectName}</div>
          <div className="rounded bg-slate-300 px-1">
            {t(`manage.catalog.objectType${request.objectType}`)}
          </div>
        </div>
        <div className="text-sm">{`${t('shared.generic.user')}: ${request.userShortname} (${request.userEmail})`}</div>
      </div>
      <div className="flex flex-row gap-2">
        <Button
          className={{
            root: 'h-7 border-green-600 hover:border-green-600 hover:text-green-800',
          }}
          data={{
            cy: `approve-sharing-request-${request.objectName}-${request.userShortname}`,
          }}
          onClick={() => setApprovalModal(true)}
        >
          <FontAwesomeIcon icon={faCheck} />
          <div>{t('shared.generic.accept')}</div>
        </Button>
        <Button
          className={{
            root: 'h-7 border-red-600 hover:border-red-600 hover:text-red-700',
          }}
          data={{
            cy: `deny-sharing-request-${request.objectName}-${request.userShortname}`,
          }}
          disabled={declineLoading}
          onClick={async (e) => {
            e?.stopPropagation()
            const result = await declineObjectSharingRequest({
              variables: {
                permissionId: request.permissionId,
                userId: request.userId,
              },
              optimisticResponse: {
                declineObjectSharingRequest: true,
              },
              update: (cache, { data }) => {
                if (!data?.declineObjectSharingRequest) return

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
              setDeclineSuccessful(true)
            } else {
              setDeclineFailure(true)
            }
          }}
        >
          <FontAwesomeIcon icon={faBan} />
          <div>{t('shared.generic.decline')}</div>
        </Button>
      </div>
      <SharingRequestApprovalModal
        request={request}
        open={approvalModal}
        onClose={() => setApprovalModal(false)}
        onSuccess={() => setApprovalSuccessful(true)}
      />
    </div>
  )
}

export default CatalogSharingRequest
