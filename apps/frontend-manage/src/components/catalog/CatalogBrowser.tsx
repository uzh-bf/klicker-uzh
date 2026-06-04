import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useRouter } from 'next/router'
import { trpc } from '../../lib/trpc'
import ObjectImport from './actions/ObjectImport'
import PendingSharingRequests from './actions/PendingSharingRequests'

function CatalogBrowser({
  catalogCollectionId,
}: {
  catalogCollectionId?: string
}) {
  const router = useRouter()
  const isCollectionView = typeof catalogCollectionId === 'string'

  // get current collection metadata (only if inside a collection)
  const { data: metaData, isLoading: metaDataLoading } =
    trpc.sharing.catalogCollectionInfo.useQuery(
      { catalogCollectionId },
      {
        enabled: isCollectionView,
      }
    )
  const collectionInfo = metaData?.catalogCollectionInfo

  if (isCollectionView && metaDataLoading) {
    return <Loader />
  }

  // redirect user to home of catalog if access is not valid
  if (
    typeof catalogCollectionId !== 'undefined' &&
    !collectionInfo &&
    !metaDataLoading
  ) {
    void router.push('/resources/catalog')
  }

  return (
    <div className="h-full">
      <PendingSharingRequests />
      <ObjectImport
        collectionName={collectionInfo?.name}
        catalogCollectionId={catalogCollectionId as string | undefined}
        collectionEditor={
          (typeof catalogCollectionId === 'undefined' ||
            collectionInfo?.isEditor) ??
          false
        }
      />
    </div>
  )
}

export default CatalogBrowser
