import { useMutation, useQuery } from '@apollo/client'
import {
  ActivateLiveQuizBlockDocument,
  DeactivateLiveQuizBlockDocument,
  ElementBlockStatus,
  EndLiveQuizDocument,
  GetCockpitQuizDocument,
  GetEscapeRoomProgressDocument,
  GetUserRunningLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import EscapeRoomProgress from '../../../components/evaluation/EscapeRoomProgress'
import AudienceInteraction from '../../../components/interaction/AudienceInteraction'
import Layout from '../../../components/Layout'
import LiveQuizTimeline from '../../../components/liveQuiz/cockpit/LiveQuizTimeline'

function Cockpit() {
  const router = useRouter()
  const t = useTranslations()

  const [activateLiveQuizBlock, { loading: activatingBlock }] = useMutation(
    ActivateLiveQuizBlockDocument
  )
  const [deactivateLiveQuizBlock, { loading: deactivatingBlock }] = useMutation(
    DeactivateLiveQuizBlockDocument
  )

  const [endLiveQuiz, { loading: endingLiveQuiz }] = useMutation(
    EndLiveQuizDocument,
    {
      update(cache, { data }) {
        // verify that the live quiz has ended successfully
        if (!data?.endLiveQuiz) return

        // update the list of running live quizzes
        cache.updateQuery(
          { query: GetUserRunningLiveQuizzesDocument },
          (qData) => {
            if (!qData?.userRunningLiveQuizzes) return qData
            return {
              userRunningLiveQuizzes: qData.userRunningLiveQuizzes.filter(
                (q) => q.id !== data.endLiveQuiz!.id
              ),
            }
          }
        )
      },
    }
  )

  const {
    loading: cockpitLoading,
    data: cockpitData,
    subscribeToMore,
  } = useQuery(GetCockpitQuizDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 2000,
    skip: !router.query.id,
  })
  // while no block is active, the table of the most recently executed escape
  // block (highest block order) stays visible
  const activeEscapeBlock = cockpitData?.cockpitQuiz?.blocks?.find(
    (block) =>
      block.id === cockpitData.cockpitQuiz?.activeBlock?.id &&
      !!block.escapeRoomConfig
  )
  const lastExecutedEscapeBlock = cockpitData?.cockpitQuiz?.blocks
    ?.filter(
      (block) =>
        block.status === ElementBlockStatus.Executed && !!block.escapeRoomConfig
    )
    .at(-1)
  const escapeBlock = activeEscapeBlock ?? lastExecutedEscapeBlock
  const {
    data: escapeRoomData,
    error: escapeRoomError,
    refetch: refetchEscapeRoom,
  } = useQuery(GetEscapeRoomProgressDocument, {
    variables: {
      liveQuizId: router.query.id as string,
      elementBlockId: escapeBlock?.id,
    },
    skip: !router.query.id || !escapeBlock,
    pollInterval: activeEscapeBlock ? 2000 : 0,
    fetchPolicy: 'network-only',
  })

  // data has not been received yet
  if (cockpitLoading || !cockpitData?.cockpitQuiz)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  const {
    id,
    name,
    displayName,
    pinCode,
    isLiveQAEnabled,
    isGamificationEnabled,
    isAssessmentEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
    startedAt,
    course,
    blocks,
    confusionSummary,
    feedbacks,
    canResetEscapeRoom,
  } = cockpitData.cockpitQuiz

  return (
    <Layout>
      <div className="mb-8 print:hidden">
        <LiveQuizTimeline
          assessmentMode={isAssessmentEnabled}
          quizId={id}
          quizName={name}
          quizDisplayName={displayName}
          quizPin={pinCode}
          blocks={blocks ?? []}
          language={course?.language ?? null}
          isGamificationEnabled={isGamificationEnabled}
          handleEndLiveQuiz={async () => {
            await endLiveQuiz({ variables: { id: id } })
            router.push('/activities')
          }}
          handleOpenBlock={async (blockId: number) => {
            await activateLiveQuizBlock({
              variables: { quizId: id, blockId },
              // high stakes mutation where cache updates are hard due to cached and db data
              refetchQueries: [
                { query: GetCockpitQuizDocument, variables: { id } },
              ],
            })
          }}
          handleCloseBlock={async (blockId: number) => {
            await deactivateLiveQuizBlock({
              variables: { quizId: id, blockId },
              // high stakes mutation where cache updates are hard due to cached and db data
              refetchQueries: [
                { query: GetCockpitQuizDocument, variables: { id } },
              ],
            })
          }}
          startedAt={startedAt}
          loading={activatingBlock || deactivatingBlock || endingLiveQuiz}
        />
      </div>

      <AudienceInteraction
        subscribeToMore={subscribeToMore}
        confusionValues={confusionSummary ?? undefined}
        feedbacks={feedbacks ?? []}
        isLiveQAEnabled={isLiveQAEnabled}
        isConfusionFeedbackEnabled={isConfusionFeedbackEnabled}
        isModerationEnabled={isModerationEnabled}
        quizId={id}
        liveQuizName={name}
      />
      {escapeBlock && escapeRoomData?.escapeRoomProgress && (
        <>
          {escapeRoomData.escapeRoomProgress.projectorDigest && (
            <div className="mx-auto flex max-w-5xl justify-end px-4">
              <Button
                onClick={() =>
                  window.open(
                    `/quizzes/${id}/escape-projector/${escapeBlock.id}?digest=${encodeURIComponent(escapeRoomData.escapeRoomProgress!.projectorDigest!)}`,
                    '_blank',
                    'noopener'
                  )
                }
                data={{ cy: 'escape-room-open-projector' }}
              >
                <Button.Label>
                  {t('manage.cockpit.escapeRoomProjector')}
                </Button.Label>
              </Button>
            </div>
          )}
          <EscapeRoomProgress
            activityType="liveQuiz"
            activityId={String(escapeBlock.id)}
            progress={escapeRoomData.escapeRoomProgress}
            onReset={refetchEscapeRoom}
            canReset={canResetEscapeRoom ?? false}
          />
        </>
      )}
      {escapeBlock && escapeRoomError ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default Cockpit
