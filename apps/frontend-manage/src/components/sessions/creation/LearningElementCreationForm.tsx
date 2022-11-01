import { H4 } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import * as yup from 'yup'

interface LearningElementCreationFormProps {}

function LearningElementCreationForm({}: LearningElementCreationFormProps) {
  const learningElementCreationSchema = yup.object().shape({
    // TODO: implement schema for session creation mutation
  })

  return (
    <div>
      <H4>Learning Element erstellen</H4>
      <Formik
        initialValues={{ TODO: '// TODO' }}
        validationSchema={learningElementCreationSchema}
        onSubmit={async (values) => {
          // TODO: creation session with corresponding mutation
        }}
      >
        {({ errors, touched, isSubmitting }) => {
          return (
            <div className="">
              <Form className="w-72 sm:w-96">
                <div>name</div>
                <div>DisplayName</div>
                <div>Kurs - select with id as value?</div>
                <div>Questions without blocks</div>
                <div>start date and end date</div>
              </Form>
            </div>
          )
        }}
      </Formik>
    </div>
  )
}

export default LearningElementCreationForm
