import { useQuery } from '@apollo/client'
import {
  GetLearningElementDocument,
  LearningElement as LearningElementType,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Layout from '../../../../components/Layout'
import Footer from '../../../../components/common/Footer'
import LearningElement from '../../../../components/learningElements/LearningElement'

interface Props {
  courseId: string
  id: string
}

// TODO: complete implementation of free text questions
function LearningElementPage({ courseId, id }: Props) {
  const t = useTranslations()

  const [currentIx, setCurrentIx] = useState(-1)

  const { loading, error, data } = useQuery(GetLearningElementDocument, {
    variables: { id },
  })

  if (loading)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  if (!data?.learningElement) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.practiceQuiz.notFound')}
        />
      </Layout>
    )
  }
  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  return (
    <Layout
      displayName={data.learningElement.displayName}
      course={data.learningElement.course ?? undefined}
    >
      <LearningElement
        element={data.learningElement as LearningElementType}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
        handleNextQuestion={handleNextQuestion}
      />
      <Footer
        browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/element/${id}`}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (
    typeof ctx.params?.courseId !== 'string' ||
    typeof ctx.params?.id !== 'string'
  ) {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      courseId: ctx.params.courseId,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default LearningElementPage
