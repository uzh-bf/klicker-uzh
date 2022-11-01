import { H4 } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import * as yup from 'yup'

interface MicroSessionCreationFormProps {}

function MicroSessionCreationForm({}: MicroSessionCreationFormProps) {
    // TODO: keep in mind that only questions with solutions (and maybe also feedbacks) should be used for learning elements
  const microSessionCreationSchema = yup.object().shape({
    // TODO: implement schema for session creation mutation
  })

  return (
    <div>
      <H4>Micro-Session erstellen</H4>
      <Formik
        initialValues={{ TODO: '// TODO' }}
        validationSchema={microSessionCreationSchema}
        onSubmit={async (values) => {
          // TODO: creation session with corresponding mutation
        }}
      >
        {({ errors, touched, isSubmitting }) => {
          return (
            <div className="">
              <Form className="w-72 sm:w-96">
                <div>SessionName</div>
                <div>Description optional with markdown, etc.</div>
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

export default MicroSessionCreationForm
