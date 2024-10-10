import { useMutation, useQuery } from '@apollo/client'
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementStack,
  GroupActivityDetailsDocument,
  GroupActivityGrading,
  GroupActivityStatus,
  StartGroupActivityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { Button, H1, Toast, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import GroupActivitySubscriber from '~/components/groupActivity/GroupActivitySubscriber'
import Layout from '../../../../components/Layout'
import GroupActivityClue from '../../../../components/groupActivity/GroupActivityClue'
import GroupActivityStack from '../../../../components/groupActivity/GroupActivityStack'

function GroupActivityDetails() {
  const t = useTranslations()
  const router = useRouter()
  const [activityEnded, setActivityEnded] = useState(false)
  const [submissionDisabled, setSubmissionDisabled] = useState(false)

  const { data, loading, error, subscribeToMore } = useQuery(
    GroupActivityDetailsDocument,
    {
      variables: {
        groupId: router.query.groupId as string,
        activityId: router.query.activityId as string,
      },
    }
  )

  useEffect(() => {
    if (
      data?.groupActivityDetails?.status === GroupActivityStatus.Ended ||
      activityEnded
    ) {
      setSubmissionDisabled(true)
    }
  }, [data?.groupActivityDetails, activityEnded])

  const [startGroupActivity, { loading: startLoading }] = useMutation(
    StartGroupActivityDocument,
    {
      variables: {
        groupId: router.query.groupId as string,
        activityId: router.query.activityId as string,
      },
      refetchQueries: [
        {
          query: GroupActivityDetailsDocument,
          variables: {
            groupId: router.query.groupId,
            activityId: router.query.activityId,
          },
        },
      ],
    }
  )

  if (!data || loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (!data.groupActivityDetails) {
    return <Layout>{t('pwa.groupActivity.activityNotYetActive')}</Layout>
  }

  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const groupActivity = data.groupActivityDetails
  const instance = groupActivity.activityInstance
  const maxTotalPoints = instance?.results?.grading.reduce(
    (acc: number, grading: GroupActivityGrading) => {
      return acc + grading.maxPoints
    },
    0
  )

  return (
    <Layout
      course={groupActivity.course}
      displayName={groupActivity.displayName}
    >
      <Head>
        <base target="_blank" />
      </Head>
      <GroupActivitySubscriber
        activityId={groupActivity.id}
        subscribeToMore={subscribeToMore}
        setEndedGroupActivity={setActivityEnded}
      />
      <div className="mx-auto flex max-w-[1800px] flex-col rounded border p-4 lg:flex-row lg:gap-12">
        <div className="lg:flex-1">
          <div>
            {(groupActivity.status === GroupActivityStatus.Ended ||
              groupActivity.status === GroupActivityStatus.Graded) && (
              <UserNotification
                type="warning"
                message={t('pwa.groupActivity.groupActivityEnded')}
                className={{ root: 'mb-4' }}
              />
            )}
            <H1>{t('pwa.groupActivity.initialSituation')}</H1>

            <Markdown
              withProse
              className={{
                root: 'prose-img:max-w-[250px] prose-img:mx-auto prose-p:mt-0',
              }}
              content={groupActivity.description ?? undefined}
            />
          </div>

          <div className="py-4">
            <H1>{t('pwa.groupActivity.yourHints')}</H1>

            <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
              {!instance &&
                groupActivity.clues.map((clue) => {
                  return (
                    <div
                      key={clue.id}
                      className="rounded border px-3 py-2 shadow"
                    >
                      <div className="font-bold">{clue.displayName}</div>
                    </div>
                  )
                })}
              {instance &&
                instance.clues?.map((clue) => {
                  return <GroupActivityClue clue={clue} key={clue.id} />
                })}
            </div>
            <div className="mt-4 rounded bg-slate-100 p-2 text-center text-sm text-slate-500">
              {t.rich('pwa.groupActivity.coordinateHints', {
                br: () => <br />,
              })}
            </div>
          </div>
        </div>

        <div className="lg:flex-1">
          {!groupActivity?.activityInstance && (
            <div className="flex flex-col pt-4 lg:pt-0">
              <H1>{t('pwa.groupActivity.yourGroup')}</H1>

              <div className="flex flex-row gap-2">
                {groupActivity.group.participants?.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex h-full w-[100px] flex-col items-center rounded border p-2 shadow"
                  >
                    <Image
                      src={
                        participant.avatar
                          ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${participant.avatar}.svg`
                          : '/user-solid.svg'
                      }
                      alt=""
                      height={40}
                      width={50}
                    />
                    <div>{participant.username}</div>
                  </div>
                ))}
              </div>

              <p className="prose mt-4 max-w-none">
                {t('pwa.groupActivity.groupCompleteQuestion')}
              </p>
              <Button
                disabled={
                  groupActivity.group.participants?.length === 1 ||
                  groupActivity.status !== GroupActivityStatus.Published
                }
                loading={startLoading}
                className={{ root: 'mt-4 self-end text-lg font-bold' }}
                onClick={() => startGroupActivity()}
                data={{ cy: 'start-group-activity' }}
              >
                {t('pwa.groupActivity.startCaps')}
              </Button>

              {groupActivity.group.participants?.length === 1 && (
                <div className="mt-4 rounded bg-red-100 p-2 text-center text-sm text-red-500">
                  {t.rich('pwa.groupActivity.minTwoPersons', {
                    br: () => <br />,
                  })}
                </div>
              )}
            </div>
          )}

          {instance && (
            <div className="py-4 lg:pt-0">
              <H1>{t('pwa.groupActivity.yourTasks')}</H1>
              {instance?.results && (
                <div
                  className={twMerge(
                    'mb-6 rounded shadow',
                    instance.results.passed
                      ? '!border-l-4 !border-l-green-500'
                      : '!border-l-4 !border-l-red-700'
                  )}
                >
                  <div
                    className={twMerge(
                      'flex flex-col justify-between px-2 py-1 text-base md:flex-row md:text-lg',
                      instance.results.passed ? 'bg-green-100' : 'bg-red-200'
                    )}
                  >
                    {instance.results.passed ? (
                      <div className="flex flex-row items-center gap-2 leading-6">
                        <FontAwesomeIcon icon={faCheck} />
                        <div>{t('pwa.groupActivity.groupActivityPassed')}</div>
                      </div>
                    ) : (
                      <div className="flex flex-row items-center gap-2 leading-6">
                        <FontAwesomeIcon icon={faXmark} />
                        <div>{t('pwa.groupActivity.groupActivityFailed')}</div>
                      </div>
                    )}
                    <div className="min-w-max self-end font-bold">{`${
                      instance.results.points
                    }/${maxTotalPoints} ${t('shared.generic.points')}`}</div>
                  </div>
                  {instance.results.comment && (
                    <DynamicMarkdown
                      className={{ root: 'mt-1 p-2 !pt-0' }}
                      content={instance.results.comment}
                      data={{ cy: 'group-activity-results-comment' }}
                    />
                  )}
                </div>
              )}
              <GroupActivityStack
                key={`group-activity-stack-ended-${activityEnded}`}
                activityId={instance.id}
                activityEnded={submissionDisabled}
                stack={groupActivity.stacks[0] as ElementStack}
                decisions={instance.decisions}
                results={instance.results}
                submittedAt={dayjs(instance.decisionsSubmittedAt).format(
                  'DD.MM.YYYY HH:mm:ss'
                )}
              />
            </div>
          )}
        </div>
      </div>
      <Toast
        type="warning"
        openExternal={activityEnded}
        onCloseExternal={() => setActivityEnded(false)}
        duration={10000}
        className={{ root: 'max-w-[30rem]' }}
        dismissible
      >
        {t('pwa.courses.groupActivityEnded', {
          activityName: groupActivity.displayName,
        })}
      </Toast>
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

export default GroupActivityDetails
