import { ObjectType } from '@lib/constants/sharingEnums'
import { Badge, H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc, type RouterOutputs } from '../../../lib/trpc'
import CatalogSeparatorTitle from './CatalogSeparatorTitle'
import CatalogSharingRequest from './CatalogSharingRequest'

type ObjectSharingRequest = NonNullable<
  RouterOutputs['sharing']['catalogSharingRequests']['catalogSharingRequests']
>[number]

function PendingSharingRequests() {
  const t = useTranslations()
  const { data, error, isLoading } =
    trpc.sharing.catalogSharingRequests.useQuery()
  const requests = data?.catalogSharingRequests

  if (isLoading && !requests) {
    return null
  }

  if (error && !requests) {
    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
        className={{ root: 'mb-8' }}
      />
    )
  }

  if (!requests || requests.length === 0) {
    return null
  }

  const groupedRequests = requests.reduce<
    Record<ObjectType, ObjectSharingRequest[]>
  >(
    (acc, request) => {
      acc[request.objectType].push(request)
      return acc
    },
    Object.values(ObjectType).reduce(
      (acc, type) => {
        acc[type] = []
        return acc
      },
      {} as Record<ObjectType, ObjectSharingRequest[]>
    )
  )

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
      {error ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
          className={{ root: 'mb-3' }}
        />
      ) : null}
      <div>
        {Object.entries(groupedRequests).map(([type, requests]) => {
          if (requests.length === 0) {
            return null
          }

          return (
            <div key={type}>
              <CatalogSeparatorTitle
                title={t(`shared.types.${type as ObjectType}`)}
              />
              {requests.map((request) => (
                <CatalogSharingRequest
                  key={`sharing-request-${request.requestId}`}
                  request={request}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PendingSharingRequests
