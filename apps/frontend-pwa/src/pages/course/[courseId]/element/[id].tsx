import { useQuery } from '@apollo/client'
import { GetLearningElementDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { StepProgress, UserNotification } from '@uzh-bf/design-system'
import { GetServerSideProps } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Footer from '../../../../components/common/Footer'
import Layout from '../../../../components/Layout'
import ElementOverview from '../../../../components/learningElements/ElementOverview'
import ElementSummary from '../../../../components/learningElements/ElementSummary'
import QuestionStack from '../../../../components/learningElements/QuestionStack'

interface Props {
  courseId: string
  id: string
}

// TODO: leaderboard and points screen after all questions have been completed?
// TODO: complete implementation of free text questions
function LearningElement({ courseId, id }: Props) {
  const t = useTranslations()
  const router = useRouter()

  const [currentIx, setCurrentIx] = useState(-1)

  const { loading, error, data } = useQuery(GetLearningElementDocument, {
    variables: { id },
  })

  const currentStack = data?.learningElement?.stacks?.[currentIx]

  if (loading) return <p>{t('shared.generic.loading')}</p>

  if (!data?.learningElement) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.learningElement.notFound')}
        />
      </Layout>
    )
  }
  if (error) return <p>Oh no... {error.message}</p>

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  return (
    <Layout
      displayName={data.learningElement.displayName}
      course={data.learningElement.course ?? undefined}
    >
      <div
        className={twMerge(
          'flex-1 space-y-4 md:max-w-6xl md:mx-auto md:mb-4 md:p-8 md:pt-6 md:border md:rounded',
          (currentIx === -1 || currentStack) && 'md:w-full'
        )}
      >
        {(currentIx === -1 || currentStack) && (
          <div>
            <StepProgress
              displayOffset={
                (data.learningElement?.stacks?.length ?? 0) > 15 ? 3 : undefined
              }
              value={currentIx}
              max={data.learningElement?.stacks?.length ?? 0}
              onItemClick={(ix: number) => setCurrentIx(ix)}
            />
          </div>
        )}

        {currentIx === -1 && (
          <ElementOverview
            displayName={data.learningElement.displayName}
            description={data.learningElement.description ?? undefined}
            numOfQuestions={data.learningElement.numOfQuestions ?? undefined}
            orderType={data.learningElement.orderType}
            resetTimeDays={data.learningElement.resetTimeDays ?? undefined}
            previouslyAnswered={
              data.learningElement.previouslyAnswered ?? undefined
            }
            stacksWithQuestions={
              data.learningElement.stacksWithQuestions ?? undefined
            }
            pointsMultiplier={data.learningElement.pointsMultiplier}
            setCurrentIx={setCurrentIx}
          />
        )}

        {currentStack && (
          <QuestionStack
            key={currentStack.id}
            elementId={data.learningElement.id}
            stack={currentStack}
            currentStep={currentIx + 1}
            totalSteps={data.learningElement.stacksWithQuestions ?? 0}
            handleNextQuestion={handleNextQuestion}
          />
        )}

        {currentIx >= 0 && !currentStack && (
          <ElementSummary
            displayName={data.learningElement.displayName}
            stacks={data.learningElement.stacks || []}
          />
        )}
      </div>

      <Footer
        browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/element/${id}`}
      />
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
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

  if (participant && !participant.avatar) {
    return {
      redirect: {
        destination: `/editProfile?redirect_to=${encodeURIComponent(
          `/course/${ctx.params.courseId}/element/${ctx.params.id}`
        )}`,
        statusCode: 302,
      },
    }
  }

  const result = await apolloClient.query({
    query: GetLearningElementDocument,
    variables: { id: ctx.params.id },
    context: participantToken
      ? {
          headers: {
            authorization: `Bearer ${participantToken}`,
          },
        }
      : undefined,
  })

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      courseId: ctx.params.courseId,
      messages: {
        ...require(`shared-components/src/intl-messages/${ctx.locale}.json`),
      },
    },
  })
}

export default LearningElement
