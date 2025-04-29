import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { SharingObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import useObjectRemoval from './useObjectRemoval'

function ObjectRemovalModal({
  objectId,
  objectType,
  objectName,
  removalModal,
  setRemovalModal,
  setRemovalSuccess,
  setRemovalFailure,
}: {
  objectId: string | number
  objectType: Omit<SharingObjectType, SharingObjectType.CatalogCollection>
  objectName: string
  removalModal: boolean
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setRemovalSuccess: Dispatch<SetStateAction<boolean>>
  setRemovalFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const { onRemove, removing } = useObjectRemoval({
    objectType: objectType as SharingObjectType,
    objectId,
    onError: () => setRemovalFailure(true),
  })

  return (
    <Modal
      title={t(`manage.sharing.remove${objectType as SharingObjectType}`)}
      open={removalModal}
      onClose={() => setRemovalModal(false)}
      dataCloseButton={{ cy: 'close-remove-object' }}
    >
      <div>
        {t(`manage.sharing.confirmRemoval${objectType as SharingObjectType}`, {
          objectName,
        })}
      </div>
      <Button
        destructive
        loading={removing}
        onClick={async () => {
          const success = await onRemove()
          if (success) {
            setRemovalSuccess(true)
            setRemovalModal(false)
          } else {
            setRemovalFailure(true)
          }
        }}
        className={{
          root: 'float-right mt-4',
        }}
        data={{ cy: 'confirm-remove-object' }}
      >
        <Button.Icon icon={faTrashCan} loading={removing} />
        <Button.Label>{t('manage.sharing.confirmRemoval')}</Button.Label>
      </Button>
    </Modal>
  )
}

export default ObjectRemovalModal
