import { ObjectAccess, ObjectType } from '@lib/constants/sharingEnums'
import { Button, H4, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import { trpc, type RouterInputs } from '../../../lib/trpc'
import ObjectTypeSelection from './ObjectTypeSelection'
import SelectObjectForCatalog from './SelectObjectForCatalog'

interface AddObjectToCatalogModalProps {
  onClose: () => void
  catalogCollectionId?: string
  onSuccess: () => void
  onError: () => void
}

export interface CatalogObjectAdditionFormValues {
  objectType?: ObjectType
  isTemplate?: boolean
  access: ObjectAccess
  objectId?: string
}

function AddObjectToCatalogModal({
  onClose,
  catalogCollectionId,
  onSuccess,
  onError,
}: AddObjectToCatalogModalProps) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const addObjectToCatalog = trpc.sharing.addObjectToCatalog.useMutation()
  const [addPending, setAddPending] = useState(false)
  const adding = addObjectToCatalog.isLoading || addPending
  const handleClose = () => {
    if (!adding) {
      onClose()
    }
  }

  return (
    <Modal
      open
      title={t('manage.catalog.addObjectToCatalogTitle')}
      onClose={handleClose}
      escapeDisabled={adding}
      className={{ content: 'max-w-2xl pb-2' }}
      dataCloseButton={{ cy: 'close-add-object-modal' }}
    >
      <Formik
        initialValues={
          {
            objectType: undefined,
            isTemplate: undefined,
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
          if (addPending) return

          setSubmitting(true)
          setAddPending(true)

          // check that values are valid
          if (
            typeof values.objectType === 'undefined' ||
            typeof values.objectId === 'undefined' ||
            typeof values.access === 'undefined'
          ) {
            setSubmitting(false)
            setAddPending(false)
            onError()
            return
          }

          try {
            const input: RouterInputs['sharing']['addObjectToCatalog'] = {
              objectId: values.objectId,
              objectType:
                values.objectType as unknown as RouterInputs['sharing']['addObjectToCatalog']['objectType'],
              access:
                values.access as unknown as RouterInputs['sharing']['addObjectToCatalog']['access'],
              catalogCollectionId,
            }
            const res = await addObjectToCatalog.mutateAsync(input)
            const success = !!res.catalogObject

            if (success) {
              utils.sharing.catalogObjects.setData(
                { catalogCollectionId },
                (data) => {
                  if (!data?.catalogObjects) return data

                  const newObject = res.catalogObject!

                  return {
                    catalogObjects: data.catalogObjects
                      .filter((obj) =>
                        typeof obj.objectId !== 'undefined' &&
                        obj.objectId !== null
                          ? obj.objectId !== newObject.objectId
                          : obj.objectUuid !== newObject.objectUuid
                      )
                      .concat(newObject),
                  }
                }
              )
              void utils.sharing.catalogCollections
                .invalidate()
                .catch(console.error)
              resetForm()
              onSuccess()
            } else {
              onError()
            }
          } catch (error) {
            console.error('Error submitting form:', error)
            onError()
          } finally {
            setSubmitting(false)
            setAddPending(false)
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
                    objectType={values.objectType as ObjectType}
                    isTemplate={values.isTemplate}
                    setFieldValue={setFieldValue}
                  />
                ) : (
                  <div className="py-4 text-center text-sm text-gray-500">
                    {t('manage.catalog.selectObjectTypeFirst')}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                primary
                type="submit"
                disabled={
                  !isValid ||
                  !dirty ||
                  !values.objectId ||
                  isSubmitting ||
                  adding
                }
                data={{ cy: 'submit-add-object-button' }}
                loading={isSubmitting || adding}
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
