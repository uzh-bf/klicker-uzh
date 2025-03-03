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

  // Object modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [addObjectSuccess, setAddObjectSuccess] = useState(false)
  const [addObjectError, setAddObjectError] = useState(false)

  // Collection modal state
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [collectionSuccess, setCollectionSuccess] = useState(false)
  const [collectionError, setCollectionError] = useState(false)

  return (
    <div className="h-full">
      <PendingSharingRequests />
      <ObjectImport
        catalogCollectionId={catalogCollectionId as string | undefined}
      />

      <div className="float-right mt-4 flex flex-row gap-3">
        {typeof catalogCollectionId === 'undefined' ? (
          <CreateCatalogCollectionButton
            setCollectionModalOpen={setCollectionModalOpen}
          />
        ) : null}
        <AddObjectToCatalogButton setIsModalOpen={setIsModalOpen} />
      </div>

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
