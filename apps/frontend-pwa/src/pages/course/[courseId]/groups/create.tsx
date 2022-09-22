import Layout from '@components/Layout'
import { Button, H1 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'

function GroupCreation({ courseId }: any) {
  return (
    <Layout
      displayName="Gruppe Erstellen"
      courseName="Banking and Finance I"
      courseColor="green"
    >
      <H1>Gruppenname:</H1>
      <Formik
        initialValues={{ groupName: '' }}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            alert(JSON.stringify(values, null, 2));
            actions.setSubmitting(false);
          }, 1000);
        }}
      >
        <Form>
          <div className='flex flex-col'>
            <Field type="text" name="groupName" placeholder="Gruppenname" />
            <ErrorMessage
              name="groupName"
              component="div"
              className="text-sm text-red-400"
            />
            <Button type="submit">Erstellen</Button>
          </div>
        </Form>
      </Formik>
    </Layout>
  )
}

export default GroupCreation
