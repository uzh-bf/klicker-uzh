import { useQuery } from '@apollo/client'
import { AvatarProps, BigHead } from '@bigheads/core'
import Layout from '@components/Layout'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import { Button, H1 } from '@uzh-bf/design-system'
import { Field, Form, Formik } from 'formik'
import * as yup from 'yup'

const EditProfile: NextPageWithLayout = () => {
  // TODO: add avatar specification as JSON field in DB and retrieve here
  const { data, error, loading } = useQuery(SelfDocument)

  // TODO: the initial values are set based on the user profile (current state of db)
  const initialValues: {
    name: string
    body: AvatarProps['body']
  } = { name: data.username, body: 'chest' }

  return (
    <Formik
      validationSchema={yup.object({
        body: yup.string(),
        // TODO: min and max length of username
        name: yup.string().min(5),
      })}
      initialValues={initialValues}
      onSubmit={(values, { setSubmitting }) => {
        setSubmitting(true)
        console.log('submit', values)
        setSubmitting(false)
      }}
    >
      {({ values, errors, isSubmitting, isValid }) => {
        return (
          <div>
            <H1>Profil Bearbeiten</H1>
            <BigHead
              style={{ width: '300px', height: '300px' }}
              accessory="roundGlasses"
              body={values.body}
              circleColor="blue"
              clothing="shirt"
              clothingColor="blue"
              eyebrows="serious"
              eyes="leftTwitch"
              faceMask={false}
              faceMaskColor="green"
              facialHair="stubble"
              graphic="none"
              hair="balding"
              hairColor="blonde"
              hat="none"
              hatColor="white"
              lashes={false}
              lipColor="red"
              mask
              mouth="lips"
              skinTone="yellow"
            />
            <Form>
              <Field as="select" name="body">
                <option value="chest">Male</option>
                <option value="breasts">Female</option>
              </Field>

              <Field type="text" name="username" />

              <Button type="submit" disabled={isSubmitting || !isValid}>
                Save
              </Button>
            </Form>
            <div>{values.body}</div>
          </div>
        )
      }}
    </Formik>
  )
}

EditProfile.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>
}

export default EditProfile
