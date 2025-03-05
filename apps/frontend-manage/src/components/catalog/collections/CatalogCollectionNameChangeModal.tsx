import { useMutation } from '@apollo/client'
import {
  ChangeCatalogCollectionNameDocument,
  GetCatalogCollectionsListDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField, Modal, Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'

interface CatalogCollectionNameChangeModalProps {
  catalogCollectionId: string
  name: string
  open: boolean
  onClose: () => void
}

function CatalogCollectionNameChangeModal({
  catalogCollectionId,
  name,
  open,
  onClose,
}: CatalogCollectionNameChangeModalProps) {
  const t = useTranslations()
  const [changeCatalogCollectionName] = useMutation(
    ChangeCatalogCollectionNameDocument
  )
  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

  const schema = Yup.object().shape({
    name: Yup.string().required(t('manage.catalog.collectionNameRequired')),
  })

  return (
    <>
      <Modal
        hideCloseButton
        escapeDisabled
        open={open}
        onClose={onClose}
        title={t('manage.catalog.changeCatalogCollectionName')}
        className={{
          content: 'w-[30rem]',
          title: 'text-xl',
        }}
      >
        <Formik
          initialValues={{
            name: name,
          }}
          onSubmit={async (values, { setSubmitting }) => {
            setSubmitting(true)

            try {
              const res = await changeCatalogCollectionName({
                variables: {
                  catalogCollectionId,
                  name: values.name,
                },
                update: (cache, { data }) => {
                  // check if request was successful
                  const success = data?.changeCatalogCollectionName
                  if (!success) return

                  // update list of answer collections
                  const queryData = cache.readQuery({
                    query: GetCatalogCollectionsListDocument,
                  })

                  if (queryData?.getCatalogCollectionsList) {
                    cache.writeQuery({
                      query: GetCatalogCollectionsListDocument,
                      data: {
                        getCatalogCollectionsList:
                          queryData?.getCatalogCollectionsList.map((obj) =>
                            obj.id === catalogCollectionId
                              ? { ...obj, name: values.name }
                              : obj
                          ),
                      },
                    })
                  }
                },
              })

              // Check if mutation was successful
              if (res.data?.changeCatalogCollectionName) {
                setSuccessToast(true)
                onClose()
              } else {
                setErrorToast(true)
              }
            } catch (error) {
              console.error('Error changing catalog collection name:', error)
              setErrorToast(true)
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
      <Toast
        dismissible
        openExternal={successToast}
        onCloseExternal={() => setSuccessToast(false)}
        type="success"
        duration={4000}
      >
        {t('manage.catalog.catalogCollectionNameChangeSuccess')}
      </Toast>
      <Toast
        dismissible
        openExternal={errorToast}
        onCloseExternal={() => setErrorToast(false)}
        type="error"
        duration={6000}
      >
        {t('manage.catalog.catalogCollectionNameChangeError')}
      </Toast>
    </>
  )
}

export default CatalogCollectionNameChangeModal
