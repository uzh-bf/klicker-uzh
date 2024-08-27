import { useMutation } from '@apollo/client'
import { EditTagDocument, Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

interface TagEditFormProps {
  tag: Tag
  onConfirm: () => void
}

function TagEditForm({ tag, onConfirm }: TagEditFormProps) {
  const t = useTranslations()
  const [editTag] = useMutation(EditTagDocument)

  const TagModifierSchema = Yup.object().shape({
    tag: Yup.string().required(t('manage.tags.validName')),
  })

  return (
    <div className="flex w-full flex-row justify-between">
      <Formik
        initialValues={{ tag: tag.name }}
        validationSchema={TagModifierSchema}
        onSubmit={async (values) => {
          if (values.tag !== tag.name) {
            await editTag({
              variables: { id: tag.id, name: values.tag },
            })
            onConfirm()
          } else {
            onConfirm()
          }
        }}
      >
        {({ errors, touched, isSubmitting, isValid }) => {
          return (
            <Form>
              <div className="flex w-full flex-row justify-between gap-2">
                <Field
                  name="tag"
                  type="tag"
                  className={twMerge(
                    'bg-uzh-grey-20 border-uzh-grey-60 focus:border-primary-40 w-full rounded border bg-opacity-50 px-1 py-1',
                    errors.tag && touched.tag && 'border-red-400 bg-red-50'
                  )}
                  data-cy="tag-modifier-field"
                />

                <Button
                  basic
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className={{
                    root: twMerge(
                      'rounded border border-solid px-2',
                      isValid && 'hover:text-primary-100 hover:bg-primary-20',
                      !isValid && 'text-uzh-grey-60 cursor-not-allowed'
                    ),
                  }}
                  data={{ cy: 'tag-editing-save' }}
                >
                  {t('shared.generic.ok')}
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
