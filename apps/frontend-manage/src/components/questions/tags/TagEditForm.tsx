import { useMutation } from '@apollo/client'
import { EditTagDocument, Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

function TagEditForm({
  tag,
  closeEditMode,
}: {
  tag: Tag
  closeEditMode: () => void
}) {
  const t = useTranslations()
  const [editTag, { loading }] = useMutation(EditTagDocument)

  const TagModifierSchema = Yup.object().shape({
    tag: Yup.string().required(t('manage.tags.validName')),
  })

  return (
    <div className="flex w-full flex-row justify-between">
      <Formik
        initialValues={{ tag: tag.name }}
        validationSchema={TagModifierSchema}
        onSubmit={async (values, { resetForm }) => {
          if (values.tag !== tag.name) {
            const result = await editTag({
              variables: { id: tag.id, name: values.tag },
            })

            if (result.data?.editTag) {
              toast({
                type: 'success',
                message: t('manage.tags.tagNameUpdatedSuccessfully'),
              })
              closeEditMode()
            } else {
              toast({ type: 'error', message: t('manage.tags.uniqueTagName') })
              resetForm()
            }
          } else {
            closeEditMode()
          }
        }}
      >
        {({ errors, touched, isValid }) => {
          return (
            <Form className="w-full">
              <div className="flex w-full flex-row justify-between gap-2">
                <Field
                  name="tag"
                  type="tag"
                  className={twMerge(
                    'bg-uzh-grey-20 border-uzh-grey-60 focus:border-primary-40 h-7 w-full rounded border bg-opacity-50 py-1 pl-1',
                    errors.tag && touched.tag && 'border-red-400 bg-red-50'
                  )}
                  data-cy="tag-modifier-field"
                />

                <Button
                  type="submit"
                  disabled={loading || !isValid}
                  className={{
                    root: twMerge('mr-0 h-7 rounded border border-solid px-2'),
                  }}
                  data={{ cy: 'tag-editing-save' }}
                >
                  <Button.Label>{t('shared.generic.ok')}</Button.Label>
                </Button>
              </div>

              <ErrorMessage
                name="tag"
                component="div"
                className="text-sm text-red-400"
              />
            </Form>
          )
        }}
      </Formik>
    </div>
  )
}

export default TagEditForm
