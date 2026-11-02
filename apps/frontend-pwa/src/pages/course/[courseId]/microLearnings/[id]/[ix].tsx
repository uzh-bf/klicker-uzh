import { useQuery } from '@apollo/client'
import {
  GetMicroLearningDocument,
  PublicationStatus,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { Progress, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../../../../components/Layout'
import { CourseChatDrawer } from '../../../../../components/chatbot/CourseChatDrawer'
import PreviewMessage from '../../../../../components/common/PreviewMessage'
import MicroLearningSubscriber from '../../../../../components/microLearning/MicroLearningSubscriber'
import ElementStack from '../../../../../components/practiceQuiz/ElementStack'
import { buildMicroLearningChatContext } from '../../../../../lib/chatbot/chatContext'

function MicrolearningInstance() {
  const t = useTranslations()
  const router = useRouter()
  const ix = parseInt(router.query.ix as string)
  const id = router.query.id as string
  const embedded = parseEmbedParam(router.query.embed)

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
  const microLearning = data?.microLearning
  const courseId = microLearning?.course?.id
  const chatContext = useMemo(
    () =>
      courseId
        ? buildMicroLearningChatContext({
            courseId,
            currentIx: Number.isFinite(ix) ? ix : undefined,
            locale: router.locale ?? 'en',
            microLearning: microLearning ?? null,
            totalSteps: microLearning?.stacks?.length ?? 0,
          })
        : null,
    [courseId, ix, microLearning, router.locale]
  )
  const nextQuery = embedded ? '?embed=true' : ''

  if (loading) {
    return (
      <Layout embedded={embedded}>
        <Loader />
      </Layout>
    )
  }

  if (!microLearning) {
    return (
      <Layout embedded={embedded}>
        <UserNotification
          type="error"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout embedded={embedded}>{t('shared.generic.systemError')}</Layout>
    )
  }

  // throw error if length of stacks is smaller than number
  if (!microLearning.stacks || !(ix <= (microLearning.stacks.length || -1))) {
    throw new Error('Stack not found')
  }

  const currentStack = microLearning.stacks[ix]
  const previewMode = microLearning.isOwner ?? undefined

  if (!courseId) {
    throw new Error('Course not found')
  }

  if (!currentStack) {
    throw new Error('Stack not found')
  }

  return (
    <Layout
      embedded={embedded}
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
            embedded={embedded}
            hideBookmark
            singleSubmission
            key={currentStack.id}
            parentId={microLearning.id}
            courseId={microLearning.course!.id}
            stack={currentStack}
            currentStep={ix + 1}
            totalSteps={microLearning.stacks?.length ?? 0}
            handleNextElement={() => {
              router.push(
                `/course/${courseId}/microLearnings/${id}/${ix + 1}${nextQuery}`
              )
            }}
            onAllStacksCompletion={() => {
              // TODO: also mark the microlearning as completed with this action already?
              router.push(
                `/course/${courseId}/microLearnings/${id}/evaluation${nextQuery}`
              )
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
      {courseId && chatContext && (
        <CourseChatDrawer
          courseId={courseId}
          context={chatContext}
          embedded={embedded}
          enabled={selfData?.self?.role === UserRole.Participant}
        />
      )}
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
