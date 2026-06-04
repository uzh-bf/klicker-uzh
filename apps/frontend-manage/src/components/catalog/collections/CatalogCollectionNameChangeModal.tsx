import { Button, FormikTextField, Modal, toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import { trpc } from '../../../lib/trpc'

function CatalogCollectionNameChangeModal({
  catalogCollectionId,
  name,
  onClose,
}: {
  catalogCollectionId: string
  name: string
  onClose: () => void
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const changeCatalogCollectionName =
    trpc.sharing.changeCatalogCollectionName.useMutation()

  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('manage.catalog.catalogCollectionNameChangeError'),
      options: { duration: 6000 },
    })

  const schema = Yup.object().shape({
    name: Yup.string().required(t('manage.catalog.collectionNameRequired')),
  })

  return (
    <Modal
      open
      hideCloseButton
      escapeDisabled
      onClose={onClose}
      title={t('manage.catalog.changeCatalogCollectionName')}
      className={{ content: 'max-w-xl pb-1' }}
    >
      <Formik
        initialValues={{
          name: name,
        }}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)

          try {
            const res = await changeCatalogCollectionName.mutateAsync({
              catalogCollectionId,
              name: values.name,
            })

            // Check if mutation was successful
            if (res.changed) {
              utils.sharing.catalogCollections.setData(
                undefined,
                (queryData) => {
                  if (!queryData?.catalogCollections) return queryData

                  return {
                    catalogCollections: queryData.catalogCollections.map(
                      (obj) =>
                        obj.id === catalogCollectionId
                          ? { ...obj, name: values.name }
                          : obj
                    ),
                  }
                }
              )
              toast({
                type: 'success',
                message: t('manage.catalog.catalogCollectionNameChangeSuccess'),
                options: { duration: 4000 },
              })
              onClose()
            } else {
              onErrorToast()
            }
          } catch (error) {
            console.error('Error changing catalog collection name:', error)
            onErrorToast()
          } finally {
            setSubmitting(false)
          }
        }}
        validationSchema={schema}
        isInitialValid={true}
      >
        {({ isValid, isSubmitting, submitForm }) => (
          <>
            <FormikTextField
              required
              autoComplete="off"
              name="name"
              label={t('manage.catalog.collectionName')}
              tooltip={t('manage.catalog.collectionNameTooltip')}
              className={{
                root: 'mb-2 w-full',
                tooltip: 'z-20 w-80',
                label: 'w-36',
              }}
              data-cy="insert-catalog-collection-name"
              shouldValidate={() => true}
            />
            <div className="mt-3 flex flex-row justify-between">
              <Button
                type="button"
                onClick={onClose}
                data={{ cy: 'catalog-collection-name-change-cancel' }}
              >
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                primary
                type="submit"
                disabled={!isValid}
                loading={isSubmitting}
                onClick={submitForm}
                data={{ cy: 'catalog-collection-name-change-confirm' }}
              >
                <Button.Label>{t('shared.generic.confirm')}</Button.Label>
              </Button>
            </div>
          </>
        )}
      </Formik>
    </Modal>
  )
}

export default CatalogCollectionNameChangeModal
