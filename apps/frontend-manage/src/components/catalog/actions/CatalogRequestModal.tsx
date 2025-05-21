import { faPaperPlane } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { ObjectAccess, ObjectType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import CatalogRequestErrorToast from './CatalogRequestErrorToast'
import CatalogAdditionalObjectInfo from './info/CatalogAdditionalObjectInfo'
import useRequestCatalogObject from './useRequestCatalogObject'

function CatalogRequestModal({
  open,
  onSuccess,
  onClose,
  objectType,
  objectId,
  objectName,
  objectOwner,
  objectAccess,
  catalogCollectionId,
}: {
  open: boolean
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
  const [errorToast, setErrorToast] = useState(false)
  const { onRequest, requesting } = useRequestCatalogObject({
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
        title={t('manage.catalog.requestCatalogObjectAccess', {
          object: t(`shared.types.${objectType}`),
        })}
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
        <div className="mt-4 flex justify-between space-x-2">
          <Button
            onClick={(e) => {
              e?.stopPropagation()
              onClose()
            }}
            data={{ cy: 'cancel-request-access' }}
          >
            <Button.Icon icon={faBan} />
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
          </Button>
          <Button
            primary
            loading={requesting}
            onClick={async (e) => {
              e?.stopPropagation()
              const success = await onRequest()

              if (success) {
                onSuccess()
              } else {
                setErrorToast(true)
              }
            }}
            data={{ cy: 'confirm-request-access' }}
          >
            <Button.Icon icon={faPaperPlane} loading={requesting} />
            <Button.Label>{t('manage.catalog.requestAccess')}</Button.Label>
          </Button>
        </div>
      </Modal>

      <CatalogRequestErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogRequestModal
