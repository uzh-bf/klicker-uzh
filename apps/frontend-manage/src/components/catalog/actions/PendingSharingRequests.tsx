import { useQuery } from '@apollo/client'
import { GetCatalogSharingRequestsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Badge, H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import CatalogSharingRequest from './CatalogSharingRequest'

function PendingSharingRequests() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetCatalogSharingRequestsDocument)
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
          <CatalogSharingRequest
            key={`sharing-request-${request.requestId}`}
            request={request}
          />
        ))}
      </div>
    </div>
  )
}

export default PendingSharingRequests
