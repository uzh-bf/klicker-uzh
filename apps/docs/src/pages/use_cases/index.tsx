import Layout from '@theme/Layout'
import { H1 } from '@uzh-bf/design-system'
import TitleBackground from '../../components/common/TitleBackground'

export default function index() {
  return (
    <Layout>
      <TitleBackground>
        <H1 className={{ root: 'mx-auto max-w-6xl lg:pl-4' }}>Use Cases</H1>
      </TitleBackground>
    </Layout>
  )
}
