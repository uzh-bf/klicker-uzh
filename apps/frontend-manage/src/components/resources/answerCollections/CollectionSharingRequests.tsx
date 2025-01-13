import { useMutation, useQuery } from '@apollo/client'
import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ApproveCollectionSharingRequestDocument,
  DeclineCollectionSharingRequestDocument,
  GetCollectionSharingRequestsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { Badge } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import AnswerCollectionCollapsible from './AnswerCollectionCollapsible'

function CollectionSharingRequests() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetCollectionSharingRequestsDocument)

  const [approveCollectionSharingRequest] = useMutation(
    ApproveCollectionSharingRequestDocument
  )
  const [declineCollectionSharingRequest] = useMutation(
    DeclineCollectionSharingRequestDocument
  )

  if (loading) {
    return null
  }

  const requests = data?.getCollectionSharingRequests
  if (!requests || requests.length === 0) {
    return null
  }

  return (
    <AnswerCollectionCollapsible
      title={
        <div className="flex flex-row items-center gap-3">
          <div>{t('manage.resources.sharingRequests')}</div>
          <Badge className="h-5 rounded bg-red-600 px-1.5 text-xs font-semibold text-white hover:bg-green-800">
            {`${requests.length} ${t('manage.resources.unresolved')}`}
          </Badge>
        </div>
      }
      className={{ root: 'mb-4' }}
    >
      <div className="mt-2 flex flex-col gap-2">
        {requests.map((request) => {
          return (
            <div
              key={`sharing-request-${request.collectionId}-${request.userId}`}
              className="flex flex-row items-center justify-between"
              data-cy={`sharing-request-${request.collectionName}-${request.userShortname}`}
            >
              <div>
                <div className="font-bold">{request.collectionName}</div>
                <div className="text-sm">{`${t('shared.generic.user')}: ${request.userShortname} (${request.userEmail})`}</div>
              </div>
              <div className="flex flex-row gap-2">
                <Button
                  className={{
                    root: 'h-7 border-green-600 hover:border-green-600 hover:text-green-800',
                  }}
                  data={{
                    cy: `approve-sharing-request-${request.collectionName}-${request.userShortname}`,
                  }}
                  onClick={() =>
                    approveCollectionSharingRequest({
                      variables: {
                        collectionId: request.collectionId,
                        userId: request.userId,
                      },
                      optimisticResponse: {
                        approveCollectionSharingRequest: true,
                      },
                      update: (cache, { data }) => {
                        if (!data?.approveCollectionSharingRequest) return

                        const queryData = cache.readQuery({
                          query: GetCollectionSharingRequestsDocument,
                        })
                        const previousRequests =
                          queryData?.getCollectionSharingRequests
                        if (!previousRequests) return

                        cache.writeQuery({
                          query: GetCollectionSharingRequestsDocument,
                          data: {
                            getCollectionSharingRequests:
                              previousRequests.filter(
                                (r) =>
                                  !(
                                    r.collectionId === request.collectionId &&
                                    r.userId === request.userId
                                  )
                              ),
                          },
                        })
                      },
                    })
                  }
                >
                  <FontAwesomeIcon icon={faCheck} />
                  <div>{t('shared.generic.accept')}</div>
                </Button>
                <Button
                  className={{
                    root: 'h-7 border-red-600 hover:border-red-600 hover:text-red-700',
                  }}
                  data={{
                    cy: `deny-sharing-request-${request.collectionName}-${request.userShortname}`,
                  }}
                  onClick={() =>
                    declineCollectionSharingRequest({
                      variables: {
                        collectionId: request.collectionId,
                        userId: request.userId,
                      },
                      optimisticResponse: {
                        declineCollectionSharingRequest: true,
                      },
                      update: (cache, { data }) => {
                        if (!data?.declineCollectionSharingRequest) return

                        const queryData = cache.readQuery({
                          query: GetCollectionSharingRequestsDocument,
                        })
                        const previousRequests =
                          queryData?.getCollectionSharingRequests
                        if (!previousRequests) return

                        cache.writeQuery({
                          query: GetCollectionSharingRequestsDocument,
                          data: {
                            getCollectionSharingRequests:
                              previousRequests.filter(
                                (r) =>
                                  !(
                                    r.collectionId === request.collectionId &&
                                    r.userId === request.userId
                                  )
                              ),
                          },
                        })
                      },
                    })
                  }
                >
                  <FontAwesomeIcon icon={faBan} />
                  <div>{t('shared.generic.decline')}</div>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </AnswerCollectionCollapsible>
  )
}

export default CollectionSharingRequests
