import { useQuery } from '@apollo/client'
import {
  GetMicroLearningDocument,
  PublicationStatus,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Progress, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../../../../../components/common/PreviewMessage'
import Layout from '../../../../../components/Layout'
import MicroLearningSubscriber from '../../../../../components/microLearning/MicroLearningSubscriber'
import ElementStack from '../../../../../components/practiceQuiz/ElementStack'

function MicrolearningInstance() {
  const t = useTranslations()
  const router = useRouter()
  const ix = parseInt(router.query.ix as string)
  const id = router.query.id as string

  const { loading, data, error, subscribeToMore } = useQuery(
    GetMicroLearningDocument,
    {
      variables: { id },
      skip: !id,
    }
  )
  const { data: selfData } = useQuery(SelfDocument, {
    skip: data?.microLearning?.isOwner ?? false,
  })

  if (loading) {
    return <Loader />
  }

  // Every branch of this route marks itself as an answering surface, including
  // the ones rendered before the microlearning has loaded: the layout decides on
  // its first render whether a product update may appear, and a later branch
  // cannot recall a request that the earlier one already sent.
  if (!data?.microLearning) {
    return (
      <Layout activelyAnswering>
        <UserNotification
          type="error"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }

  if (error) {
    return <Layout activelyAnswering>{t('shared.generic.systemError')}</Layout>
  }

  const microLearning = data.microLearning

  // throw error if length of stacks is smaller than number
  if (!microLearning.stacks || !(ix <= (microLearning.stacks.length || -1))) {
    throw new Error('Stack not found')
  }

  const currentStack = microLearning.stacks[ix]
  const previewMode = microLearning.isOwner ?? undefined
  const courseId = microLearning.course?.id

  if (!currentStack) {
    throw new Error('Stack not found')
  }

  return (
    <Layout
      activelyAnswering
      displayName={microLearning.displayName}
      course={microLearning.course ?? undefined}
    >
      <MicroLearningSubscriber
        activityId={microLearning.id}
        microLearningName={microLearning.displayName}
        subscribeToMore={subscribeToMore}
      />
      <div className="flex-1">
        <div
          className={twMerge(
            'w-full space-y-4 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:border md:p-8 md:pt-6'
          )}
        >
          <Progress
            isMaxVisible
            formatter={(v) => v}
            value={ix + 1}
            max={(microLearning?.stacks?.length ?? -1) + 1}
          />
          {previewMode ? (
            <PreviewMessage
              activityType={t('shared.generic.microlearning')}
              name={microLearning.name}
              displayName={microLearning.displayName}
            />
          ) : null}
          <ElementStack
            hideBookmark
            singleSubmission
            key={currentStack.id}
            parentId={microLearning.id}
            courseId={microLearning.course!.id}
            stack={currentStack}
            currentStep={ix + 1}
            totalSteps={microLearning.stacks?.length ?? 0}
            handleNextElement={() => {
              router.push(`/course/${courseId}/microLearnings/${id}/${ix + 1}`)
            }}
            onAllStacksCompletion={() => {
              // TODO: also mark the microlearning as completed with this action already?
              router.push(`/course/${courseId}/microLearnings/${id}/evaluation`)
            }}
            withParticipant={
              !!selfData?.self &&
              selfData.self.role !== UserRole.TemporaryParticipant
            }
            activityExpired={microLearning.status === PublicationStatus.Ended}
            activityExpiredMessage={t('pwa.microLearning.activityExpired')}
            previewOnly={previewMode}
          />
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default MicrolearningInstance
