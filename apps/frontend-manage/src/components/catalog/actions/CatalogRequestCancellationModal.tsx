import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ObjectType } from '@lib/constants/sharingEnums'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState, type MouseEvent } from 'react'
import useRequestCancellationCatalogObject from './useRequestCancellationCatalogObject'

function CatalogRequestCancellationModal({
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
      message: t('manage.catalog.requestCancellationFailed'),
    })

  const { onCancellation, cancelling } = useRequestCancellationCatalogObject({
    objectType,
    objectId,
    catalogCollectionId,
  })
  const [cancellationPending, setCancellationPending] = useState(false)
  const pending = cancelling || cancellationPending
  const handleClose = (e?: MouseEvent) => {
    e?.stopPropagation()
    if (!pending) {
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={handleClose}
      escapeDisabled={pending}
      title={t('manage.catalog.cancelCatalogObjectRequest', {
        object: t(`shared.types.${objectType}`),
      })}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!pending && <FontAwesomeIcon icon={faTrashCan} />}
          <span>{t('manage.catalog.cancelRequest')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={pending}
      primaryDisabled={pending}
      onPrimaryAction={async (e) => {
        e?.stopPropagation()
        if (pending) return

        setCancellationPending(true)
        let success = false

        try {
          success = await onCancellation()
        } finally {
          setCancellationPending(false)
        }

        if (!success) {
          onErrorToast()
          return
        }

        onSuccess()
      }}
      dataPrimaryAction={{ cy: 'confirm-request-cancellation' }}
      className={{ footer: 'justify-end', content: 'max-w-xl' }}
    >
      <div>
        {t.rich('manage.catalog.cancelCatalogObjectRequestDescription', {
          name: objectName,
          owner: objectOwner ?? t('shared.generic.unknown'),
          b: (children) => <b>{children}</b>,
        })}
      </div>
    </Modal>
  )
}

export default CatalogRequestCancellationModal
