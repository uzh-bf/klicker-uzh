import { useMutation } from '@apollo/client'
import Layout from '@components/Layout'
import { JoinParticipantGroupDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { useRouter } from 'next/router'

function GroupJoin() {
  const router = useRouter()
  const courseId = String(router.query.courseId)

  const [joinParticipantGroup] = useMutation(JoinParticipantGroupDocument)

  return (
    <Layout
      displayName="Gruppe Beitreten"
      courseName="Banking and Finance I - STILL HARDCODED"
      courseColor="green"
    >
      <H1>Code:</H1>
      <Formik
        initialValues={{ code: '' }}
        onSubmit={async (values, actions) => {
          setTimeout(() => {
            alert(JSON.stringify(values, null, 2))
            actions.setSubmitting(false)
          }, 1000)

          console.log(values.code)
          console.log(Number(values.code) >> 0)

          const result = await joinParticipantGroup({
            variables: {
              courseId: courseId,
              code: Number(values.code) >> 0,
            },
          })

          // if this result is not null, the join was successful, otherwise the group does not exist (at least not on this course)
          console.log('mutation result', result.data?.joinParticipantGroup)
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
