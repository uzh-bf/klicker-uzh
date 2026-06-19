import { faPaperPlane } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { ObjectAccess, ObjectType } from '@lib/constants/sharingEnums'
import { Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import CatalogAdditionalObjectInfo from './info/CatalogAdditionalObjectInfo'
import useRequestCatalogObject from './useRequestCatalogObject'

function CatalogRequestModal({
  onSuccess,
  onClose,
  objectType,
  objectId,
  objectName,
  objectOwner,
  objectAccess,
  catalogCollectionId,
}: {
  onSuccess: () => void
  onClose: () => void
  objectType: ObjectType
  objectId: string | number
  objectName: string
  objectOwner?: string | null
  objectAccess: ObjectAccess
  catalogCollectionId?: string
}) {
  const t = useTranslations()

  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('manage.catalog.requestCatalogObjectFailed'),
    })

  const { onRequest, requesting } = useRequestCatalogObject({
    objectType,
    objectId,
    catalogCollectionId,
    onError: onErrorToast,
  })

  return (
    <Modal
      open
      onClose={(e) => {
        e?.stopPropagation()
        onClose()
      }}
      title={t('manage.catalog.requestCatalogObjectAccess', {
        object: t(`shared.types.${objectType}`),
      })}
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
      dataSecondaryAction={{ cy: 'cancel-request-access' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faPaperPlane} />
          <span>{t('manage.catalog.requestAccess')}</span>
        </div>
      }
      primaryLoading={requesting}
      onPrimaryAction={async (e) => {
        e?.stopPropagation()
        const success = await onRequest()

        if (success) {
          onSuccess()
        } else {
          onErrorToast()
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-request-access' }}
    >
      {objectAccess === ObjectAccess.Public ? (
        <UserNotification
          type="warning"
          message={t('manage.catalog.requestPublicResource')}
          className={{ root: 'mb-3' }}
        />
      ) : null}
      <div>
        {t.rich('manage.catalog.requestCatalogObjectAccessDescription', {
          name: objectName,
          owner: objectOwner ?? t('shared.generic.unknown'),
          b: (children) => <b>{children}</b>,
        })}{' '}
        {t(`manage.catalog.requestSuccessInfo${objectType}`)}
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

export default CatalogRequestModal
