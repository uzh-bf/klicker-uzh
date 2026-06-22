import Loader from '@klicker-uzh/shared-components/src/Loader'
import { toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { trpc } from '../../lib/trpc'
import ObjectImport from './actions/ObjectImport'
import PendingSharingRequests from './actions/PendingSharingRequests'

function CatalogBrowser({
  catalogCollectionId,
}: {
  catalogCollectionId?: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const isCollectionView = typeof catalogCollectionId === 'string'
  const [redirectError, setRedirectError] = useState(false)

  // get current collection metadata (only if inside a collection)
  const {
    data: metaData,
    error: metaDataError,
    isLoading: metaDataLoading,
  } = trpc.sharing.catalogCollectionInfo.useQuery(
    { catalogCollectionId },
    {
      enabled: isCollectionView,
    }
  )
  const collectionInfo = metaData?.catalogCollectionInfo
  const collectionMissing =
    isCollectionView && !collectionInfo && !metaDataLoading && !metaDataError

  useEffect(() => {
    if (!collectionMissing) return

    let active = true
    setRedirectError(false)

    async function redirectToCatalog() {
      try {
        const routed = await router.push('/resources/catalog')
        if (!routed && active) {
          window.location.assign('/resources/catalog')
        }
      } catch (error) {
        console.error(error)
        if (active) {
          setRedirectError(true)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
        }
      }
    }

    void redirectToCatalog()

    return () => {
      active = false
    }
  }, [collectionMissing, router, t])

  if (isCollectionView && metaDataLoading && !collectionInfo) {
    return <Loader />
  }

  if (isCollectionView && metaDataError && !collectionInfo) {
    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
      />
    )
  }

  if (collectionMissing) {
    if (!redirectError) {
      return <Loader />
    }

    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
      />
    )
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
