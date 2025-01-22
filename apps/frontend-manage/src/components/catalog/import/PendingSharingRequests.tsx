import { useMutation, useQuery } from '@apollo/client'
import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CountCatalogSharingRequestsDocument,
  DeclineObjectSharingRequestDocument,
  GetCatalogSharingRequestsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Toast } from '@uzh-bf/design-system'
import { Badge } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import SharingRequestApprovalModal from './SharingRequestApprovalModal'

function PendingSharingRequests() {
  const t = useTranslations()
  const [approvalModal, setApprovalModal] = useState(false)
  const [declineSuccessful, setDeclineSuccessful] = useState(false)
  const [declineFailure, setDeclineFailure] = useState(false)
  const [approvalSuccessful, setApprovalSuccessful] = useState(false)

  const { data, loading } = useQuery(GetCatalogSharingRequestsDocument)
  const [declineObjectSharingRequest, { loading: declineLoading }] =
    useMutation(DeclineObjectSharingRequestDocument)

  const requests = data?.getCatalogSharingRequests

  if (loading || !requests || requests.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      <div className="flex flex-row items-center gap-3">
        <H2>{t('manage.catalog.sharingRequests')}</H2>
        <Badge className="mb-1 h-5 rounded bg-red-600 px-1.5 text-xs font-semibold text-white hover:bg-red-700">
          {`${requests.length} ${t('manage.catalog.unresolved')}`}
        </Badge>
      </div>
      <div className="mb-3 text-sm">
        {t('manage.catalog.sharingRequestsExplanation')}
      </div>
      <div className="border-t">
        {requests.map((request) => (
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
                      const previousRequests =
                        queryData?.getCatalogSharingRequests

                      const queryData2 = cache.readQuery({
                        query: CountCatalogSharingRequestsDocument,
                      })
                      const requestsCount =
                        queryData2?.countCatalogSharingRequests

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
        ))}
      </div>
      <Toast
        dismissible
        type="success"
        duration={4000}
        openExternal={declineSuccessful}
        onCloseExternal={() => setDeclineSuccessful(false)}
        className={{ root: 'max-w-[30rem]' }}
      >
        {t('manage.catalog.declineSuccessful')}
      </Toast>
      <Toast
        dismissible
        type="error"
        duration={5000}
        openExternal={declineFailure}
        onCloseExternal={() => setDeclineFailure(false)}
        className={{ root: 'max-w-[30rem]' }}
      >
        {t('manage.catalog.declineFailed')}
      </Toast>
      <Toast
        dismissible
        type="success"
        duration={4000}
        openExternal={approvalSuccessful}
        onCloseExternal={() => setApprovalSuccessful(false)}
        className={{ root: 'max-w-[30rem]' }}
      >
        {t('manage.catalog.approvalSuccessful')}
      </Toast>
    </div>
  )
}

export default PendingSharingRequests
