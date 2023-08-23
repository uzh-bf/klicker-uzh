import Layout from '@theme/Layout'
import { H1, H2 } from '@uzh-bf/design-system'
import Content from '../../components/Content'
import TitleBackground from '../../components/common/TitleBackground'

export default function index() {
  return (
    <Layout>
      <TitleBackground>
        <H1 className={{ root: 'mx-auto max-w-6xl lg:pl-4' }}>Use Cases</H1>
      </TitleBackground>

      <Content>
        <H2>Strenghten Interaction</H2>
        <div className="">CONTENT</div>

        <H2 className={{ root: 'mt-6' }}>Implement Gamification Elements</H2>
        <div className="">Test</div>

        <H2 className={{ root: 'mt-6' }}>Knowledge Feedback</H2>
        <div className="">Test</div>

        <H2 className={{ root: 'mt-6' }}>Learning Beyond Classroom</H2>
        <div className="">Test</div>
      </Content>
    </Layout>
  )
}
