import { useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  ModifyAnswerCollectionDocument,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import * as Yup from 'yup'
import EditorField from '../../activities/creation/EditorField'
import AnswerCollectionAccessSelection from './AnswerCollectionAccessSelection'
import AnswerCollectionCatalogSelection from './AnswerCollectionCatalogSelection'

function AnswerCollectionMetaForm({
  collection,
  setSuccessToast,
  onDelete,
}: {
  collection: AnswerCollection
  setSuccessToast: Dispatch<SetStateAction<boolean>>
  onDelete: () => void
}) {
  const t = useTranslations()
  const [modifyAnswerCollection] = useMutation(ModifyAnswerCollectionDocument)

  return (
    <Formik
      initialValues={{
        name: collection.name,
        access: collection.access,
        description: collection.description,
        catalogCollectionId: collection.catalogCollectionId ?? '',
      }}
      onSubmit={async (values) => {
        const { data } = await modifyAnswerCollection({
          variables: {
            id: collection.id,
            name: values.name !== collection.name ? values.name : undefined,
            access:
              values.access !== collection.access ? values.access : undefined,
            description:
              values.description !== collection.description
                ? values.description
                : undefined,
            catalogCollectionId:
              values.catalogCollectionId === ''
                ? undefined
                : values.catalogCollectionId,
          },
        })

        if (data?.modifyAnswerCollection?.id) {
          setSuccessToast(true)
        }
      }}
      validationSchema={Yup.object({
        name: Yup.string().required(t('manage.resources.nameRequired')),
        access: Yup.string().required(),
        description: Yup.string().required(
          t('manage.resources.descriptionRequired')
        ),
      })}
    >
      {({ values, isValid, isSubmitting }) => (
        <Form className="flex flex-col">
          <div className="flex space-x-4">
            <FormikTextField
              required
              name="name"
              label={t('manage.resources.name')}
              tooltip={t('manage.resources.nameTooltip')}
              data={{ cy: 'answer-collection-name' }}
            />
            <AnswerCollectionAccessSelection />
          </div>
          {values.access !== ObjectAccess.Private ? (
            <AnswerCollectionCatalogSelection className="mb-3" />
          ) : null}
          <EditorField
            required
            label={t('shared.generic.description')}
            tooltip={t('manage.resources.descriptionTooltip')}
            placeholder={t('manage.resources.descriptionPlaceholder')}
            fieldName="description"
            showToolbarOnFocus={false}
            data={{ cy: 'answer-collection-description' }}
            className={{ root: 'mb-4' }}
          />
          <UserNotification
            message={
              (collection.numSharedUsers ?? 0) > 0
                ? t('manage.resources.infoAccessChangeLimited')
                : t(`manage.resources.infoAccess${values.access}`)
            }
            className={{ root: 'mb-2' }}
          />
          <Button
            type="submit"
            disabled={!isValid}
            loading={isSubmitting}
            className={{
              root: 'w-max self-end border-green-600 hover:border-green-600',
            }}
            data={{ cy: 'save-changes-answer-collection' }}
          >
            <FontAwesomeIcon icon={faSave} className="mr-1" />
            <div>{t('manage.resources.saveChanges')}</div>
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default AnswerCollectionMetaForm
