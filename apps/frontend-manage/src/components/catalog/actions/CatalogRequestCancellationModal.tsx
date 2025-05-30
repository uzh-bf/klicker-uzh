import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
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
    onError: onErrorToast,
  })

  return (
    <Modal
      open={open}
      onClose={(e) => {
        e?.stopPropagation()
        onClose()
      }}
      title={t('manage.catalog.cancelCatalogObjectRequest', {
        object: t(`shared.types.${objectType}`),
      })}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faTrashCan} />
          <span>{t('manage.catalog.cancelRequest')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={cancelling}
      onPrimaryAction={async (e) => {
        e?.stopPropagation()
        const success = await onCancellation()
        if (success) {
          onSuccess()
        } else {
          onErrorToast()
        }
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
