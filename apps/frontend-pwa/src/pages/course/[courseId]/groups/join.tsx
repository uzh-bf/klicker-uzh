import Layout from '@components/Layout'
import { Button, H1 } from '@uzh-bf/design-system'

function GroupJoin({ courseId }: any) {
  return (
    <Layout
      displayName="Gruppe Beitreten"
      courseName="Banking and Finance I"
      courseColor="green"
    >
      <H1>Code</H1>
      <p>[empty box for code]</p>
      <Button>Beitreten</Button>
    </Layout>
  )
}

export default GroupJoin
