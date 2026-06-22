import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { Progress, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../../../../../components/common/PreviewMessage'
import Layout from '../../../../../components/Layout'
import MicroLearningSubscriber from '../../../../../components/microLearning/MicroLearningSubscriber'
import ElementStack from '../../../../../components/practiceQuiz/ElementStack'

const PUBLICATION_STATUS_ENDED = 'ENDED'
const TEMPORARY_PARTICIPANT_ROLE = 'TEMPORARY_PARTICIPANT'
type ElementStackProp = Parameters<typeof ElementStack>[0]['stack']

function MicrolearningInstance() {
  const t = useTranslations()
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const ixParam = typeof router.query.ix === 'string' ? router.query.ix : ''
  const ix = Number.parseInt(ixParam, 10)

  const utils = trpc.useUtils()
  const { isLoading, data, error } = trpc.participant.microLearning.useQuery(
    { id },
    { enabled: id !== '' }
  )
  const {
    data: selfData,
    error: selfError,
    isLoading: selfLoading,
  } = trpc.participant.self.useQuery(undefined, {
    enabled: !(data?.microLearning?.isOwner ?? false),
  })

  if (isLoading && !data) {
    return <Loader />
  }

  if (error && !data?.microLearning) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  if (!data?.microLearning) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }

  const microLearning = data.microLearning
  const stackCount = microLearning.stacks?.length ?? 0

  if (!Number.isInteger(ix) || ix < 0 || ix >= stackCount) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }

  const currentStack = microLearning.stacks[ix]
  const previewMode = microLearning.isOwner ?? undefined
  const courseId = microLearning.course?.id
  const selfUnavailable = Boolean(selfError && !selfData?.self)
  const waitingForSelf =
    !previewMode && selfLoading && typeof selfData === 'undefined'

  if (!currentStack) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }

  return (
    <Layout
      displayName={microLearning.displayName}
      course={microLearning.course ?? undefined}
    >
      <MicroLearningSubscriber
        activityId={microLearning.id}
        microLearningName={microLearning.displayName}
        onEnded={(endedMicroLearning) =>
          utils.participant.microLearning.setData({ id }, (previous) =>
            previous?.microLearning
              ? {
                  microLearning: {
                    ...previous.microLearning,
                    ...endedMicroLearning,
                  },
                }
              : previous
          )
        }
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
            max={stackCount}
          />
          {previewMode ? (
            <PreviewMessage
              activityType={t('shared.generic.microlearning')}
              name={microLearning.name}
              displayName={microLearning.displayName}
            />
          ) : null}
          {selfUnavailable ? (
            <UserNotification
              type="error"
              message={t('shared.generic.systemError')}
            />
          ) : null}
          {waitingForSelf ? (
            <Loader />
          ) : (
            <ElementStack
              hideBookmark
              singleSubmission
              key={currentStack.id}
              parentId={microLearning.id}
              courseId={microLearning.course!.id}
              stack={currentStack as ElementStackProp}
              currentStep={ix + 1}
              totalSteps={microLearning.stacks?.length ?? 0}
              handleNextElement={() => {
                router.push(
                  `/course/${courseId}/microLearnings/${id}/${ix + 1}`
                )
              }}
              onAllStacksCompletion={() => {
                // TODO: also mark the microlearning as completed with this action already?
                router.push(
                  `/course/${courseId}/microLearnings/${id}/evaluation`
                )
              }}
              withParticipant={
                !!selfData?.self &&
                selfData.self.role !== TEMPORARY_PARTICIPANT_ROLE
              }
              activityExpired={
                microLearning.status === PUBLICATION_STATUS_ENDED
              }
              activityExpiredMessage={t('pwa.microLearning.activityExpired')}
              previewOnly={previewMode}
            />
          )}
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
