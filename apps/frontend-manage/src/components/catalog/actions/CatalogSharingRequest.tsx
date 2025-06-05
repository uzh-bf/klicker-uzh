import { useMutation } from '@apollo/client'
import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import {
  CountCatalogSharingRequestsDocument,
  DeclineObjectSharingRequestDocument,
  GetCatalogSharingRequestsDocument,
  ObjectSharingRequest,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import SharingRequestApprovalModal from './SharingRequestApprovalModal'

function CatalogSharingRequest({ request }: { request: ObjectSharingRequest }) {
  const t = useTranslations()
  const [approvalModal, setApprovalModal] = useState(false)
  const [declineObjectSharingRequest, { loading: declineLoading }] =
    useMutation(DeclineObjectSharingRequestDocument)

  return (
    <div
      key={`sharing-request-${request.requestId}`}
      className="flex flex-row items-center justify-between border-b py-1 text-sm"
      data-cy={`sharing-request-${request.objectName}-${request.userShortname}`}
    >
      <div>
        <div className="flex flex-row items-center gap-4">
          <div className="font-bold">{request.objectName}</div>
          <div className="rounded bg-slate-300 px-1">
            {t(`shared.types.${request.objectType}`)}
          </div>
        </div>
        <div className="text-sm">{`${t('shared.generic.user')}: ${request.userShortname} (${request.userEmail})`}</div>
      </div>
      <div className="flex flex-row gap-2">
        <Button
          className={{
            root: 'h-7 border-green-600 hover:text-green-800',
          }}
          data={{
            cy: `approve-sharing-request-${request.objectName}-${request.userShortname}`,
          }}
          onClick={() => setApprovalModal(true)}
        >
          <Button.Icon icon={faCheck} />
          <Button.Label>{t('shared.generic.accept')}</Button.Label>
        </Button>
        <Button
          className={{
            root: 'h-7 border-red-600 py-0 hover:text-red-700',
          }}
          data={{
            cy: `deny-sharing-request-${request.objectName}-${request.userShortname}`,
          }}
          disabled={declineLoading}
          onClick={async (e) => {
            e?.stopPropagation()
            const result = await declineObjectSharingRequest({
              variables: {
                requestId: request.requestId,
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
              toast({
                type: 'success',
                message: t('manage.catalog.declineSuccessful'),
                options: { duration: 3000 },
              })
            } else {
              toast({
                type: 'error',
                message: t('manage.catalog.declineFailed'),
                options: { duration: 5000 },
              })
            }
          }}
        >
          <Button.Icon icon={faBan} />
          <Button.Label>{t('shared.generic.decline')}</Button.Label>
        </Button>
      </div>
      <SharingRequestApprovalModal
        request={request}
        open={approvalModal}
        onClose={() => setApprovalModal(false)}
        onSuccess={() =>
          toast({
            type: 'success',
            message: t('manage.catalog.approvalSuccessful'),
            options: { duration: 3000 },
          })
        }
      />
    </div>
  )
}

export default CatalogSharingRequest
