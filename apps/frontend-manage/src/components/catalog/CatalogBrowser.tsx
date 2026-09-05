import { useQuery } from '@apollo/client'
import { GetCatalogCollectionInfoDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useRouter } from 'next/router'
import ObjectImport from './actions/ObjectImport'
import PendingSharingRequests from './actions/PendingSharingRequests'

function CatalogBrowser({
  catalogCollectionId,
}: {
  catalogCollectionId?: string
}) {
  const router = useRouter()

  // get current collection metadata (only if inside a collection)
  const { data: metaData, loading: metaDataLoading } = useQuery(
    GetCatalogCollectionInfoDocument,
    {
      variables: {
        catalogCollectionId: catalogCollectionId as string,
      },
      skip: typeof catalogCollectionId !== 'string',
    }
  )

  if (metaDataLoading) {
    return <Loader />
  }

  // redirect user to home of catalog if access is not valid
  if (
    typeof catalogCollectionId !== 'undefined' &&
    !metaData?.getCatalogCollectionInfo &&
    !metaDataLoading
  ) {
    router.push('/resources/catalog')
  }

  return (
    <div className="min-h-full shrink-0">
      <PendingSharingRequests />
      <ObjectImport
        collectionName={metaData?.getCatalogCollectionInfo?.name}
        catalogCollectionId={catalogCollectionId as string | undefined}
        collectionEditor={
          (typeof catalogCollectionId === 'undefined' ||
            metaData?.getCatalogCollectionInfo?.isEditor) ??
          false
        }
      />
    </div>
  )
}

export default CatalogBrowser
