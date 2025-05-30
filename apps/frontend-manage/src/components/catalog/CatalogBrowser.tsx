import { useQuery } from '@apollo/client'
import { GetCatalogCollectionInfoDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import ObjectImport from './actions/ObjectImport'
import PendingSharingRequests from './actions/PendingSharingRequests'
import AddObjectToCatalogButton from './administration/AddObjectToCatalogButton'
import AddObjectToCatalogModal from './administration/AddObjectToCatalogModal'
import CreateCatalogCollectionButton from './collections/CreateCatalogCollectionButton'
import CreateCatalogCollectionModal from './collections/CreateCatalogCollectionModal'

function CatalogBrowser({
  catalogCollectionId,
}: {
  catalogCollectionId?: string
}) {
  const router = useRouter()
  const t = useTranslations()

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
  const collectionName = metaData?.getCatalogCollectionInfo?.name
  const userIsCollectionEditor =
    (typeof catalogCollectionId === 'undefined' ||
      metaData?.getCatalogCollectionInfo?.isEditor) ??
    false

  // object modal states
  const [isModalOpen, setIsModalOpen] = useState(false)

  // catalog collection modal states
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)

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
    <div className="h-full">
      <PendingSharingRequests />
      <ObjectImport
        collectionName={collectionName}
        catalogCollectionId={catalogCollectionId as string | undefined}
        collectionEditor={userIsCollectionEditor}
      />

      <div className="float-right mt-4 flex flex-row gap-3">
        {typeof catalogCollectionId === 'undefined' ? (
          <CreateCatalogCollectionButton
            setCollectionModalOpen={setCollectionModalOpen}
          />
        ) : null}
        {userIsCollectionEditor ? (
          <AddObjectToCatalogButton setIsModalOpen={setIsModalOpen} />
        ) : null}
      </div>

      {userIsCollectionEditor ? (
        <AddObjectToCatalogModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          catalogCollectionId={catalogCollectionId as string | undefined}
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.objectAddedSuccess'),
              options: { duration: 3500 },
            })
            setIsModalOpen(false)
          }}
          onError={() =>
            toast({
              type: 'error',
              message: t('manage.catalog.objectAddedError'),
              options: { duration: 5000 },
            })
          }
        />
      ) : null}

      {typeof catalogCollectionId === 'undefined' ? (
        <CreateCatalogCollectionModal
          open={collectionModalOpen}
          onClose={() => setCollectionModalOpen(false)}
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.collectionCreationSuccess'),
              options: { duration: 3500 },
            })
            setCollectionModalOpen(false)
          }}
          onError={() =>
            toast({
              type: 'error',
              message: t('manage.catalog.collectionCreationError'),
              options: { duration: 5000 },
            })
          }
        />
      ) : null}
    </div>
  )
}

export default CatalogBrowser
