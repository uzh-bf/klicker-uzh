import Layout from '@components/Layout'
import { Button, H1 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { useRouter } from 'next/router'

function GroupJoin() {
  const router = useRouter()
  const courseId = router.query.courseId

  return (
    <Layout
      displayName="Gruppe Beitreten"
      courseName="Banking and Finance I"
      courseColor="green"
    >
      <H1>Code:</H1>
      <Formik
        initialValues={{ code: '' }}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            alert(JSON.stringify(values, null, 2))
            actions.setSubmitting(false)
          }, 1000)
        }}
      >
        <Form>
          <div className="flex flex-col">
            <Field type="text" name="code" placeholder="Code" />
            <ErrorMessage
              name="code"
              component="div"
              className="text-sm text-red-400"
            />
            <Button type="submit">Beitreten</Button>
          </div>
        </Form>
      </Formik>
    </Layout>
  )
}

export default GroupJoin
