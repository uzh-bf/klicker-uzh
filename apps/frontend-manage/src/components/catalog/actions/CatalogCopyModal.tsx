import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { ObjectType } from '@lib/constants/sharingEnums'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense, type MouseEvent } from 'react'
import CatalogAdditionalObjectInfo from './info/CatalogAdditionalObjectInfo'
import useCopyCatalogObject from './useCopyCatalogObject'

function CatalogCopyModal({
  onSuccess,
  onClose,
  objectType,
  objectId,
  objectName,
  objectOwner,
  catalogCollectionId,
}: {
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
      message: t('manage.catalog.copyCatalogObjectFailed'),
    })

  const { onCopy, copying } = useCopyCatalogObject({
    objectType,
    objectId,
    catalogCollectionId,
  })
  const handleClose = (e?: MouseEvent) => {
    e?.stopPropagation()
    if (!copying) {
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={handleClose}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faBan} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-object-copy' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!copying && <FontAwesomeIcon icon={faCopy} />}
          <span>
            {t('manage.catalog.copyObjectType', {
              object: t(`shared.types.${objectType}`),
            })}
          </span>
        </div>
      }
      primaryLoading={copying}
      primaryDisabled={copying}
      onPrimaryAction={async (e) => {
        e?.stopPropagation()
        const success = await onCopy()

        if (success) {
          onSuccess()
        } else {
          onErrorToast()
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-object-copy' }}
      title={t('manage.catalog.copyPublicResource')}
      dataCloseButton={{ cy: 'close-object-copy-modal' }}
    >
      <div>
        {t.rich('manage.catalog.copyCatalogObjectDescription', {
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

export default CatalogCopyModal
