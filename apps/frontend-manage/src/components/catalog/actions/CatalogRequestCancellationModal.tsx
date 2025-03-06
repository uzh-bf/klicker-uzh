import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CatalogRequestCancellationErrorToast from './CatalogRequestCancellationErrorToast'
import useRequestCancellationCatalogObject from './useRequestCancellationCatalogObject'

function CatalogRequestCancellationModal({
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
  const { onCancellation, cancelling } = useRequestCancellationCatalogObject({
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
        title={t('manage.catalog.cancelCatalogObjectRequest', {
          object: t(`shared.types.${objectType}`),
        })}
      >
        <div>
          {t.rich('manage.catalog.cancelCatalogObjectRequestDescription', {
            name: objectName,
            owner: objectOwner ?? t('shared.generic.unknown'),
            b: (children) => <b>{children}</b>,
          })}
        </div>
        <div className="mt-4 flex justify-end space-x-2">
          <Button
            destructive
            loading={cancelling}
            onClick={async (e) => {
              e?.stopPropagation()
              const success = await onCancellation()

              if (success) {
                onSuccess()
              } else {
                setErrorToast(true)
              }
            }}
            data={{ cy: 'confirm-request-cancellation' }}
          >
            <Button.Icon icon={faTrashCan} />
            <Button.Label>{t('manage.catalog.cancelRequest')}</Button.Label>
          </Button>
        </div>
      </Modal>

      <CatalogRequestCancellationErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogRequestCancellationModal
