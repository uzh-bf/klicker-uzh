import { useRouter } from 'next/router'
import { useState } from 'react'
import AddObjectToCatalogButton from './administration/AddObjectToCatalogButton'
import AddObjectToCatalogModal from './administration/AddObjectToCatalogModal'
import ObjectAddedErrorToast from './administration/ObjectAddedErrorToast'
import ObjectAddedSuccessToast from './administration/ObjectAddedSuccessToast'
import ObjectImport from './import/ObjectImport'
import PendingSharingRequests from './import/PendingSharingRequests'

function CatalogBrowser() {
  const router = useRouter()
  const { catalogCollectionId } = router.query
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [addObjectSuccess, setAddObjectSuccess] = useState(false)
  const [addObjectError, setAddObjectError] = useState(false)

  return (
    <div className="h-full">
      <PendingSharingRequests />
      <ObjectImport
        catalogCollectionId={catalogCollectionId as string | undefined}
      />
      <div className="float-right">
        <AddObjectToCatalogButton setIsModalOpen={setIsModalOpen} />
      </div>

      <AddObjectToCatalogModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        catalogCollectionId={catalogCollectionId as string}
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
    </div>
  )
}

export default CatalogBrowser
