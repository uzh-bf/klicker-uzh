import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import CatalogObjectCopyErrorToast from './CatalogObjectCopyErrorToast'
import CatalogAdditionalObjectInfo from './info/CatalogAdditionalObjectInfo'
import useCopyCatalogObject from './useCopyCatalogObject'

function CatalogCopyModal({
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
  const [errorToast, setErrorToast] = useState(false)
  const { onCopy, copying } = useCopyCatalogObject({
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
        secondaryLabel={
          <div className="flex flex-row items-center gap-1">
            <FontAwesomeIcon icon={faBan} />
            <span>{t('shared.generic.cancel')}</span>
          </div>
        }
        onSecondaryAction={(e) => {
          e?.stopPropagation()
          onClose()
        }}
        dataSecondaryAction={{ cy: 'cancel-object-copy gap-1.5' }}
        primaryLabel={
          <div className="flex flex-row items-center">
            <FontAwesomeIcon icon={faCopy} />
            <span>
              {t('manage.catalog.copyObjectType', {
                object: t(`shared.types.${objectType}`),
              })}
            </span>
          </div>
        }
        primaryLoading={copying}
        onPrimaryAction={async (e) => {
          e?.stopPropagation()
          const success = await onCopy()

          if (success) {
            onSuccess()
          } else {
            setErrorToast(true)
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
      <CatalogObjectCopyErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogCopyModal
