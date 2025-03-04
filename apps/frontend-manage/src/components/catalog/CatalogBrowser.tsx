import { useQuery } from '@apollo/client'
import { GetCatalogCollectionInfoDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useRouter } from 'next/router'
import { useState } from 'react'
import AddObjectToCatalogButton from './administration/AddObjectToCatalogButton'
import AddObjectToCatalogModal from './administration/AddObjectToCatalogModal'
import ObjectAddedErrorToast from './administration/ObjectAddedErrorToast'
import ObjectAddedSuccessToast from './administration/ObjectAddedSuccessToast'
import CatalogCollectionCreationErrorToast from './collections/CatalogCollectionCreationErrorToast'
import CatalogCollectionCreationSuccessToast from './collections/CatalogCollectionCreationSuccessToast'
import CreateCatalogCollectionButton from './collections/CreateCatalogCollectionButton'
import CreateCatalogCollectionModal from './collections/CreateCatalogCollectionModal'
import ObjectImport from './import/ObjectImport'
import PendingSharingRequests from './import/PendingSharingRequests'

function CatalogBrowser() {
  const router = useRouter()
  const { catalogCollectionId } = router.query

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
  const [addObjectSuccess, setAddObjectSuccess] = useState(false)
  const [addObjectError, setAddObjectError] = useState(false)

  // catalog collection modal states
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [collectionSuccess, setCollectionSuccess] = useState(false)
  const [collectionError, setCollectionError] = useState(false)

  if (metaDataLoading) {
    return <Loader />
  }

  // redirect user to home of catalog if access is not valid
  if (
    typeof catalogCollectionId !== 'undefined' &&
    !metaData?.getCatalogCollectionInfo &&
    !metaDataLoading
  ) {
    router.push({ pathname: '/resources/catalog', query: {} })
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
        <>
          <AddObjectToCatalogModal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            catalogCollectionId={catalogCollectionId as string | undefined}
            onSuccess={() => {
              setAddObjectSuccess(true)
              setIsModalOpen(false)
            }}
            onError={() => setAddObjectError(true)}
          />
          <ObjectAddedSuccessToast
            open={addObjectSuccess}
            onClose={() => setAddObjectSuccess(false)}
          />
          <ObjectAddedErrorToast
            open={addObjectError}
            onClose={() => setAddObjectError(false)}
          />
        </>
      ) : null}

      {typeof catalogCollectionId === 'undefined' ? (
        <>
          <CreateCatalogCollectionModal
            open={collectionModalOpen}
            onClose={() => setCollectionModalOpen(false)}
            onSuccess={() => {
              setCollectionSuccess(true)
              setCollectionModalOpen(false)
            }}
            onError={() => setCollectionError(true)}
          />
          <CatalogCollectionCreationSuccessToast
            open={collectionSuccess}
            onClose={() => setCollectionSuccess(false)}
          />
          <CatalogCollectionCreationErrorToast
            open={collectionError}
            onClose={() => setCollectionError(false)}
          />
        </>
      ) : null}
    </div>
  )
}

export default CatalogBrowser
