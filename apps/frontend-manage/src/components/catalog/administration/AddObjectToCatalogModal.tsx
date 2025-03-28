import { useMutation } from '@apollo/client'
import {
  AddObjectToCatalogDocument,
  CatalogObjectType,
  GetCatalogObjectsDocument,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H4, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import ObjectTypeSelection from './ObjectTypeSelection'
import SelectObjectForCatalog from './SelectObjectForCatalog'

interface AddObjectToCatalogModalProps {
  open: boolean
  onClose: () => void
  catalogCollectionId?: string
  onSuccess: () => void
  onError: () => void
}

export interface CatalogObjectAdditionFormValues {
  objectType?: CatalogObjectType
  access: ObjectAccess
  objectId?: string
}

function AddObjectToCatalogModal({
  open,
  onClose,
  catalogCollectionId,
  onSuccess,
  onError,
}: AddObjectToCatalogModalProps) {
  const t = useTranslations()
  const [addObjectToCatalog] = useMutation(AddObjectToCatalogDocument)

  return (
    <Modal
      title={t('manage.catalog.addObjectToCatalogTitle')}
      open={open}
      onClose={onClose}
      className={{ content: 'max-w-2xl' }}
      dataCloseButton={{ cy: 'close-add-object-modal' }}
    >
      <Formik
        initialValues={
          {
            objectType: undefined,
            access: ObjectAccess.Restricted,
            objectId: undefined,
          } as CatalogObjectAdditionFormValues
        }
        validationSchema={Yup.object().shape({
          objectType: Yup.string().required(
            t('manage.catalog.objectTypeRequired')
          ),
          access: Yup.string().required(t('manage.catalog.accessRequired')),
          objectId: Yup.mixed().when('objectType', {
            is: (val: string) => !!val,
            then: () =>
              Yup.mixed().required(t('manage.catalog.objectRequired')),
          }),
        })}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          setSubmitting(true)

          // check that values are valid
          if (
            typeof values.objectType === 'undefined' ||
            typeof values.objectId === 'undefined' ||
            typeof values.access === 'undefined'
          ) {
            setSubmitting(false)
            onError()
            return
          }

          try {
            const res = await addObjectToCatalog({
              variables: {
                objectId: values.objectId,
                objectType: values.objectType,
                access: values.access,
                catalogCollectionId,
              },
              update: (cache, { data }) => {
                if (!data?.addObjectToCatalog) return

                const prevObjects = cache.readQuery({
                  query: GetCatalogObjectsDocument,
                  variables: {
                    catalogCollectionId,
                  },
                })

                if (!prevObjects?.getCatalogObjects) {
                  return
                }

                const newObject = data.addObjectToCatalog
                const modifiedObjectId = newObject.id
                const modifiedObjectUuid = newObject.uuid
                const newObjects = prevObjects.getCatalogObjects
                  .filter((obj) =>
                    typeof obj.id !== 'undefined' && obj.id !== null
                      ? obj.id !== modifiedObjectId
                      : obj.uuid !== modifiedObjectUuid
                  )
                  .concat(newObject)

                cache.writeQuery({
                  query: GetCatalogObjectsDocument,
                  variables: {
                    catalogCollectionId,
                  },
                  data: {
                    getCatalogObjects: newObjects,
                  },
                })
              },
            })
            const success = !!res.data?.addObjectToCatalog

            if (success) {
              resetForm()
              setSubmitting(false)
              onSuccess()
            } else {
              setSubmitting(false)
              onError()
            }
          } catch (error) {
            console.error('Error submitting form:', error)
            setSubmitting(false)
            onError()
          }
        }}
      >
        {({ values, isValid, dirty, isSubmitting, setFieldValue }) => (
          <Form>
            <p className="mb-4 text-gray-600">
              {t('manage.catalog.selectObjectTypeDescription')}
            </p>

            <div className="space-y-8">
              {/* Step 1: Object Type and Access Level Selection */}
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <H4>1. {t('manage.catalog.selectObjectType')}</H4>
                <ObjectTypeSelection
                  objectTypeValue={values.objectType}
                  accessValue={values.access}
                  setFieldValue={setFieldValue}
                />
              </div>

              {/* Step 2: Object Selection */}
              <div
                className={`rounded-md border p-4 ${values.objectType ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-gray-100'}`}
              >
                <H4>2. {t('manage.catalog.selectSpecificObject')}</H4>

                {values.objectType ? (
                  <SelectObjectForCatalog
                    objectType={values.objectType as CatalogObjectType}
                    setFieldValue={setFieldValue}
                  />
                ) : (
                  <div className="py-4 text-center text-sm text-gray-500">
                    {t('manage.catalog.selectObjectTypeFirst')}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                primary
                type="submit"
                disabled={!isValid || !dirty || !values.objectId}
                data={{ cy: 'submit-add-object-button' }}
                loading={isSubmitting}
              >
                <Button.Label>{t('shared.generic.save')}</Button.Label>
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default AddObjectToCatalogModal
