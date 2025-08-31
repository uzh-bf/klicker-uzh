import { useMutation } from '@apollo/client'
import {
  CreateCatalogCollectionDocument,
  GetCatalogCollectionsListDocument,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextField,
  Modal,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'
import ObjectAccessSelection from '../administration/ObjectAccessSelection'

function CreateCatalogCollectionModal({
  onClose,
  onSuccess,
  onError,
}: {
  onClose: () => void
  onSuccess: () => void
  onError: () => void
}) {
  const t = useTranslations()
  const [createCatalogCollection] = useMutation(CreateCatalogCollectionDocument)

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.catalog.createCatalogCollectionTitle')}
      data={{ cy: 'create-catalog-collection-modal' }}
      className={{ content: 'pb-1' }}
    >
      <div className="mb-4 text-sm">
        {t('manage.catalog.createCatalogCollectionDescription')}
      </div>

      <Formik
        initialValues={{
          name: '',
          access: ObjectAccess.Public,
        }}
        validationSchema={yup.object().shape({
          name: yup.string().required(t('manage.catalog.nameRequired')),
          access: yup.string().required(t('manage.catalog.accessRequired')),
        })}
        onSubmit={async (values, { resetForm }) => {
          try {
            const res = await createCatalogCollection({
              variables: {
                name: values.name,
                access: values.access as ObjectAccess,
              },
              update: (cache, { data }) => {
                // check if the creation was successful
                if (!data?.createCatalogCollection) return

                // update the cached list of catalog collections
                cache.updateQuery(
                  { query: GetCatalogCollectionsListDocument },
                  (qData) => ({
                    getCatalogCollectionsList: [
                      ...(qData?.getCatalogCollectionsList ?? []),
                      data.createCatalogCollection!,
                    ],
                  })
                )
              },
            })

            if (res.data?.createCatalogCollection) {
              resetForm()
              onSuccess()
            } else {
              onError()
            }
          } catch (error) {
            console.error('Error creating catalog collection:', error)
            onError()
          }
        }}
      >
        {({ values, setFieldValue, isValid, isSubmitting }) => (
          <Form className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 md:flex-row">
              <FormikTextField
                name="name"
                label={t('manage.catalog.collectionName')}
                tooltip={t('manage.catalog.collectionNameTooltip')}
                placeholder={t('manage.catalog.collectionNamePlaceholder')}
                required
                data={{ cy: 'catalog-collection-name-input' }}
              />

              <ObjectAccessSelection
                hideTooltip
                value={values.access}
                onChange={(value) => setFieldValue('access', value)}
                cyPrefix="modal"
              />
            </div>
            <UserNotification
              message={t(
                `manage.catalog.accessDescription${values.access as ObjectAccess}`
              )}
            />

            <div className="flex justify-between gap-2">
              <Button
                onClick={onClose}
                data={{ cy: 'cancel-catalog-collection-creation' }}
              >
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                type="submit"
                primary
                disabled={!isValid || isSubmitting}
                loading={isSubmitting}
                data={{ cy: 'create-catalog-collection-submit' }}
              >
                <Button.Label>{t('shared.generic.create')}</Button.Label>
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default CreateCatalogCollectionModal
