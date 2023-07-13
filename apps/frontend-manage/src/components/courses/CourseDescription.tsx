import { useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ChangeCourseDescriptionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import ContentInput from 'shared-components/src/ContentInput'
import * as Yup from 'yup'

interface CourseDescriptionProps {
  courseId: string
  description: string
  submitText: string
  setDescriptionEditMode: (newValue: boolean) => void
}

function CourseDescription({
  courseId,
  description,
  submitText,
  setDescriptionEditMode,
}: CourseDescriptionProps) {
  const [changeCourseDescription] = useMutation(ChangeCourseDescriptionDocument)

  const descriptionSchema = Yup.object().shape({
    description: Yup.string().test({
      message: 'Bitte fügen Sie einen Inhalt zu Ihrer Kursbeschreibung hinzu',
      test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
    }),
  })

  const changeDescription = (
    newDescription: string,
    setSubmitting: (isSubmitting: boolean) => void
  ) => {
    setSubmitting(true)
    if (!newDescription.match(/^(<br>(\n)*)$/g) && newDescription !== '') {
      changeCourseDescription({
        variables: {
          courseId: courseId,
          input: newDescription,
        },
      })
    }
    setDescriptionEditMode(false)
    setSubmitting(false)
  }

  return (
    <Formik
      initialValues={{ description: description }}
      onSubmit={(values, { setSubmitting }) =>
        changeDescription(values.description, setSubmitting)
      }
      validationSchema={descriptionSchema}
    >
      {({ values, setFieldValue, isSubmitting, isValid, touched, errors }) => (
        <div className="flex-1">
          <Form>
            <ContentInput
              placeholder="Beschreibung hinzufügen"
              touched={touched.description}
              content={values.description}
              onChange={(newValue: string) =>
                setFieldValue('description', newValue)
              }
            />

            <div className="flex flex-row justify-between mt-1">
              {errors && (
                <div className="text-sm text-red-700">{errors.description}</div>
              )}
              <Button
                className={{
                  root: 'float-right px-5 text-white disabled:opacity-60 bg-primary-80',
                }}
                type="submit"
                disabled={isSubmitting || !isValid}
              >
                <Button.Icon className={{ root: 'mr-1' }}>
                  <FontAwesomeIcon icon={faSave} />
                </Button.Icon>
                <Button.Label>{submitText}</Button.Label>
              </Button>
            </div>
          </Form>
        </div>
      )}
    </Formik>
  )
}

export default CourseDescription
