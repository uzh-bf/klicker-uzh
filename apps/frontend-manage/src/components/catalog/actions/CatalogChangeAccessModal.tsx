import { ObjectAccess, ObjectType } from '@lib/constants/sharingEnums'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc, type RouterInputs } from '../../../lib/trpc'

function CatalogChangeAccessModal({
  onClose,
  objectType,
  objectName,
  assignmentId,
  newAccess,
  catalogCollectionId,
}: {
  onClose: () => void
  objectType: ObjectType
  objectName: string
  assignmentId?: number
  newAccess: ObjectAccess
  catalogCollectionId?: string
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const changeCatalogObjectAccess =
    trpc.sharing.changeCatalogObjectAccess.useMutation()
  const changeCatalogCollectionAccess =
    trpc.sharing.changeCatalogCollectionAccess.useMutation()
  const changing =
    changeCatalogObjectAccess.isLoading ||
    changeCatalogCollectionAccess.isLoading
  const handleClose = () => {
    if (!changing) {
      onClose()
    }
  }

  return (
    <Modal
      open
      title={t('manage.catalog.changeAccessTitle')}
      onClose={handleClose}
      primaryLabel={t('manage.catalog.changeAccessConfirm')}
      onPrimaryAction={async () => {
        let success = false

        try {
          // if assignment id is defined, the access level of a catalog object is changed
          if (typeof assignmentId !== 'undefined') {
            const input: RouterInputs['sharing']['changeCatalogObjectAccess'] =
              {
                assignmentId,
                access:
                  newAccess as unknown as RouterInputs['sharing']['changeCatalogObjectAccess']['access'],
              }
            const res = await changeCatalogObjectAccess.mutateAsync(input)

            if (res.changed) {
              utils.sharing.catalogObjects.setData(
                { catalogCollectionId },
                (data) => {
                  if (!data?.catalogObjects) return data

                  return {
                    catalogObjects: data.catalogObjects.map((obj) =>
                      obj.id === assignmentId
                        ? { ...obj, access: newAccess }
                        : obj
                    ),
                  }
                }
              )
            }
            success = res.changed
          }
          // otherwise, the access level of a catalog collection is changed
          else if (typeof catalogCollectionId !== 'undefined') {
            const input: RouterInputs['sharing']['changeCatalogCollectionAccess'] =
              {
                catalogCollectionId,
                access:
                  newAccess as unknown as RouterInputs['sharing']['changeCatalogCollectionAccess']['access'],
              }
            const res = await changeCatalogCollectionAccess.mutateAsync(input)

            if (res.changed) {
              utils.sharing.catalogCollections.setData(undefined, (data) => {
                if (!data?.catalogCollections) return data

                return {
                  catalogCollections: data.catalogCollections.map((obj) =>
                    obj.id === catalogCollectionId
                      ? { ...obj, access: newAccess }
                      : obj
                  ),
                }
              })
            }
            success = res.changed
          } else {
            console.error('No assignment id or catalog collection id provided')
            success = false
          }
        } catch (e) {
          console.error('Error changing object access', e)
          success = false
        }

        if (success) {
          onClose()
        } else {
          toast({
            type: 'error',
            message: t('manage.catalog.changeAccessError'),
            options: { duration: 4500 },
          })
        }
      }}
      primaryLoading={changing}
      primaryDisabled={changing}
      dataPrimaryAction={{ cy: 'confirm-access-change' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-access-change' }}
      className={{ content: 'max-w-lg' }}
      data={{ cy: 'change-access-modal' }}
    >
      <div className="flex flex-col gap-4">
        <div>
          {t('manage.catalog.changeAccessDescription', {
            objectType: t(`shared.types.${objectType}`),
            objectName: objectName,
            newAccess: t(`manage.catalog.access${newAccess}`),
          })}
        </div>
      </div>
    </Modal>
  )
}

export default CatalogChangeAccessModal
