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
    <div className="flex flex-row justify-between w-full">
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
              <div className="flex flex-row justify-between w-full gap-2">
                <Field
                  name="tag"
                  type="tag"
                  className={twMerge(
                    'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 py-1 px-1 focus:border-primary-40',
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
                      'px-2 rounded border border-solid',
                      isValid && 'sm:hover:text-primary hover:bg-primary-20',
                      !isValid && 'text-uzh-grey-60 cursor-not-allowed'
                    ),
                  }}
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
