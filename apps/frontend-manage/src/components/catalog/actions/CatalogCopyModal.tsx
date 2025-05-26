import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal } from '@uzh-bf/design-system'
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
        <div className="mt-4 flex justify-between space-x-2">
          <Button
            onClick={(e) => {
              e?.stopPropagation()
              onClose()
            }}
            data={{ cy: 'cancel-object-copy' }}
          >
            <Button.Icon icon={faBan} />
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
          </Button>
          <Button
            primary
            loading={copying}
            onClick={async (e) => {
              e?.stopPropagation()
              const success = await onCopy()

              if (success) {
                onSuccess()
              } else {
                setErrorToast(true)
              }
            }}
            data={{ cy: 'confirm-object-copy' }}
          >
            <Button.Icon icon={faCopy} loading={copying} />
            <Button.Label>
              {t('manage.catalog.copyObjectType', {
                object: t(`shared.types.${objectType}`),
              })}
            </Button.Label>
          </Button>
        </div>
      </Modal>

      <CatalogObjectCopyErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogCopyModal
