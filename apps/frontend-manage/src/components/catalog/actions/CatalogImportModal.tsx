import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import CatalogObjectImportErrorToast from './CatalogObjectImportErrorToast'
import CatalogAdditionalObjectInfo from './info/CatalogAdditionalObjectInfo'
import useImportCatalogObject from './useImportCatalogObject'

function CatalogImportModal({
  open,
  onSuccess,
  onClose,
  objectType,
  objectId,
  objectName,
  objectOwner,
  catalogCollectionId,
}: {
  open: boolean
  onSuccess: () => void
  onClose: () => void
  objectType: CatalogObjectType
  objectId: string | number
  objectName: string
  objectOwner?: string | null
  catalogCollectionId?: string
}) {
  const t = useTranslations()
  const [errorToast, setErrorToast] = useState(false)
  const { onImport, importing } = useImportCatalogObject({
    objectType,
    objectId,
    catalogCollectionId,
    onError: () => setErrorToast(true),
  })

  return (
    <>
      <Modal
        open={open}
        onClose={(e) => {
          e?.stopPropagation()
          setErrorToast(false)
          onClose()
        }}
        title={t('manage.catalog.importPublicResource')}
        dataCloseButton={{ cy: 'close-object-import-modal' }}
      >
        <div>
          {t.rich('manage.catalog.importCatalogObjectDescription', {
            name: objectName,
            owner: objectOwner ?? t('shared.generic.unknown'),
            b: (children) => <b>{children}</b>,
          })}
        </div>
        <Suspense fallback={<Loader />}>
          <CatalogAdditionalObjectInfo
            objectType={objectType}
            objectId={objectId}
          />
        </Suspense>
        <div className="mt-4 flex justify-between space-x-2">
          <Button
            onClick={(e) => {
              e?.stopPropagation()
              onClose()
            }}
            data={{ cy: 'cancel-object-import' }}
          >
            <Button.Icon icon={faBan} />
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
          </Button>
          <Button
            primary
            loading={importing}
            onClick={async (e) => {
              e?.stopPropagation()
              const success = await onImport()

              if (success) {
                onSuccess()
              } else {
                setErrorToast(true)
              }
            }}
            data={{ cy: 'confirm-object-import' }}
          >
            <Button.Icon icon={faCopy} />
            <Button.Label>
              {t('manage.catalog.importObjectType', {
                object: t(`shared.types.${objectType}`),
              })}
            </Button.Label>
          </Button>
        </div>
      </Modal>

      <CatalogObjectImportErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogImportModal
