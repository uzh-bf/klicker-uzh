import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CatalogObjectRequestErrorToast from './CatalogObjectRequestErrorToast'
import useRequestCatalogObject from './useRequestCatalogObject'

function CatalogRequestModal({
  open,
  onSuccess,
  onClose,
  objectType,
  objectId,
  objectName,
  objectOwner,
}: {
  open: boolean
  onSuccess: () => void
  onClose: () => void
  objectType: CatalogObjectType
  objectId: string | number
  objectName: string
  objectOwner?: string | null
}) {
  const t = useTranslations()
  const [errorToast, setErrorToast] = useState(false)
  const { onRequest, requesting } = useRequestCatalogObject({
    objectType,
    objectId,
    onError: () => setErrorToast(true),
  })

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('manage.catalog.requestCatalogObjectAccess', {
          object: t(`shared.types.${objectType}`),
        })}
      >
        <div>
          {t.rich('manage.catalog.requestCatalogObjectAccessDescription', {
            name: objectName,
            owner: objectOwner ?? t('shared.generic.unknown'),
            b: (children) => <b>{children}</b>,
          })}{' '}
          {t(`manage.catalog.requestSuccessInfo${objectType}`)}
        </div>
        {/* // TODO: add custom information component depending on object type */}
        <div>CUSTOM INFO / PREVIEW PLACEHOLDER</div>
        <div className="mt-4 flex justify-end space-x-2">
          <Button onClick={onClose} data={{ cy: 'cancel-request-access' }}>
            {t('shared.generic.cancel')}
          </Button>
          <Button
            primary
            loading={requesting}
            onClick={async () => {
              const success = await onRequest()

              if (success) {
                onSuccess()
              } else {
                setErrorToast(true)
              }
            }}
            data={{ cy: 'confirm-request-access' }}
          >
            {t('manage.catalog.requestAccess')}
          </Button>
        </div>
      </Modal>

      <CatalogObjectRequestErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogRequestModal
