import { faBan, faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
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
  objectType: ObjectType
  objectId: string | number
  objectName: string
  objectOwner?: string | null
  catalogCollectionId?: string
}) {
  const t = useTranslations()

  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('manage.catalog.importCatalogObjectFailed'),
    })

  const { onImport, importing } = useImportCatalogObject({
    objectType,
    objectId,
    catalogCollectionId,
    onError: () => onErrorToast(),
  })

  return (
    <Modal
      open={open}
      onClose={(e) => {
        e?.stopPropagation()
        onClose()
      }}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faBan} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={(e) => {
        e?.stopPropagation()
        onClose()
      }}
      dataSecondaryAction={{ cy: 'cancel-object-import' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faDownload} />
          <span>
            {t('manage.catalog.importObjectType', {
              object: t(`shared.types.${objectType}`),
            })}
          </span>
        </div>
      }
      onPrimaryAction={async (e) => {
        e?.stopPropagation()
        const success = await onImport()
        if (success) {
          onSuccess()
        } else {
          onErrorToast()
        }
      }}
      primaryLoading={importing}
      dataPrimaryAction={{ cy: 'confirm-object-import' }}
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
    </Modal>
  )
}

export default CatalogImportModal
