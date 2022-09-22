import Layout from '@components/Layout'
import { Button, H1 } from '@uzh-bf/design-system'

function GroupCreation({ courseId }: any) {
  return (
    <Layout
      displayName="Gruppe Erstellen"
      courseName="Banking and Finance I"
      courseColor="green"
    >
      <H1>Name</H1>
      <p>[empty box for gorupname]</p>
      <Button>Erstellen</Button>
    </Layout>
  )
}

export default GroupCreation
