import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { trpc, type RouterOutputs } from '../../../lib/trpc'
import SharingRequestApprovalModal from './SharingRequestApprovalModal'

type ObjectSharingRequest = NonNullable<
  RouterOutputs['sharing']['catalogSharingRequests']['catalogSharingRequests']
>[number]

function CatalogSharingRequest({ request }: { request: ObjectSharingRequest }) {
  const t = useTranslations()
  const [approvalModal, setApprovalModal] = useState(false)
  const utils = trpc.useUtils()
  const declineObjectSharingRequest =
    trpc.sharing.declineObjectSharingRequest.useMutation()

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

  // TODO: add requested permission levels, once UI supports the selection of a specific one during request
  return (
    <div
      key={`sharing-request-${request.requestId}`}
      className="flex flex-row items-center justify-between border-b px-3 py-2 text-sm hover:bg-slate-100"
      data-cy={`sharing-request-${request.objectName}-${request.userShortname}`}
    >
      <div>
        <div>{request.objectName}</div>
        <div className="text-xs text-slate-500">{`${t('shared.generic.user')}: ${request.userShortname} (${request.userEmail})`}</div>
      </div>
      <div className="flex flex-row gap-2">
        <Button
          className={{
            root: 'h-7 border-green-600 hover:text-green-800',
          }}
          data={{
            cy: `approve-sharing-request-${request.objectName}-${request.userShortname}`,
          }}
          disabled={declineObjectSharingRequest.isLoading}
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
          disabled={declineObjectSharingRequest.isLoading}
          onClick={async (e) => {
            e?.stopPropagation()
            try {
              const result = await declineObjectSharingRequest.mutateAsync({
                requestId: request.requestId,
                userId: request.userId,
              })

              if (result.resolved) {
                removeRequestFromCaches()
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
            } catch (error) {
              console.error(error)
              toast({
                type: 'error',
                message: t('manage.catalog.declineFailed'),
                options: { duration: 5000 },
              })
            }
          }}
        >
          <Button.Icon
            icon={faBan}
            loading={declineObjectSharingRequest.isLoading}
          />
          <Button.Label>{t('shared.generic.decline')}</Button.Label>
        </Button>
      </div>
      {approvalModal && (
        <SharingRequestApprovalModal
          request={request}
          onClose={() => setApprovalModal(false)}
          onSuccess={() =>
            toast({
              type: 'success',
              message: t('manage.catalog.approvalSuccessful'),
              options: { duration: 3000 },
            })
          }
        />
      )}
    </div>
  )
}

export default CatalogSharingRequest
