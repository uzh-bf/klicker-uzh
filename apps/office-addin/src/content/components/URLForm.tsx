import { Button, FormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import * as yup from 'yup'

export interface URLFormProps {
  slideID: number
  setSelectedURL: (url: string) => void
}

export function URLForm({ slideID, setSelectedURL }: URLFormProps) {
  return (
    <Formik
      initialValues={{
        url: '',
      }}
      validationSchema={yup.object({
        url: yup
          .string()
          .matches(
            /https:\/\/manage\.klicker\.uzh\.ch\/(sessions|quizzes)\/.{36}\/evaluation\?hmac=.{64}.*/,
            'Please enter a valid URL according to the steps described'
          )
          .required(
            'Please enter a valid URL according to the steps described'
          ),
      })}
      onSubmit={async (values) => {
        Office.context.document.settings.set(
          'selectedURL' + slideID,
          values.url
        )

        Office.context.document.settings.saveAsync()

        setSelectedURL(values.url)
      }}
    >
      <Form className="flex w-full flex-row gap-4">
        <FormikTextField
          required
          autoComplete="off"
          name="url"
          label="URL"
          labelType="large"
          tooltip="Enter the embedding URL of the evaluation you want to add to this slide"
          className={{ root: 'w-full' }}
          placeholder="https://manage.klicker.uzh.ch/quizzes/12345/evaluation?hmac=xyz"
          data={{ cy: 'url-form-input' }}
        />
        <Button type="submit">Embed</Button>
      </Form>
    </Formik>
  )
}

export default URLForm
