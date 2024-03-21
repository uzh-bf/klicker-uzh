import { useMutation, useQuery } from '@apollo/client'
import {
  ElementStack,
  GroupActivityDetailsDocument,
  StartGroupActivityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H1 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Layout from '../../../../components/Layout'
import GroupActivityClue from '../../../../components/groupActivity/GroupActivityClue'
import GroupActivityStack from '../../../../components/groupActivity/GroupActivityStack'

function GroupActivityDetails() {
  const t = useTranslations()
  const router = useRouter()

  const { data, loading, error } = useQuery(GroupActivityDetailsDocument, {
    variables: {
      groupId: router.query.groupId as string,
      activityId: router.query.activityId as string,
    },
  })

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

  return (
    <Layout
      course={data.groupActivityDetails.course}
      displayName={data.groupActivityDetails.displayName}
    >
      <Head>
        <base target="_blank" />
      </Head>

      <div className="flex flex-col lg:gap-12 p-4 mx-auto border rounded max-w-[1800px] lg:flex-row">
        <div className="lg:flex-1">
          <div className="">
            <H1>{t('pwa.groupActivity.initialSituation')}</H1>

            <Markdown
              withProse
              className={{
                root: 'prose-img:max-w-[250px] prose-img:mx-auto prose-p:mt-0',
              }}
              content={data.groupActivityDetails.description ?? undefined}
            />
          </div>

          <div className="py-4">
            <H1>{t('pwa.groupActivity.yourHints')}</H1>

            <div className="grid grid-cols-1 gap-2 mt-2 text-xs md:grid-cols-2">
              {!data.groupActivityDetails.activityInstance &&
                data.groupActivityDetails.clues.map((clue) => {
                  return (
                    <div
                      key={clue.id}
                      className="px-3 py-2 border rounded shadow"
                    >
                      <div className="font-bold">{clue.displayName}</div>
                    </div>
                  )
                })}
              {data.groupActivityDetails.activityInstance &&
                data.groupActivityDetails.activityInstance.clues?.map(
                  (clue) => {
                    return <GroupActivityClue clue={clue} key={clue.id} />
                  }
                )}
            </div>
            <div className="p-2 mt-4 text-sm text-center rounded text-slate-500 bg-slate-100">
              {t.rich('pwa.groupActivity.coordinateHints', {
                br: () => <br />,
              })}
            </div>
          </div>
        </div>

        <div className="lg:flex-1">
          {!data.groupActivityDetails?.activityInstance && (
            <div className="flex flex-col pt-4 lg:pt-0">
              <H1>{t('pwa.groupActivity.yourGroup')}</H1>

              <div className="flex flex-row gap-2">
                {data.groupActivityDetails.group.participants?.map(
                  (participant) => (
                    <div
                      key={participant.id}
                      className="border rounded shadow w-[100px] h-full p-2 flex flex-col items-center"
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
                  )
                )}
              </div>

              <p className="mt-4 prose max-w-none">
                {t('pwa.groupActivity.groupCompleteQuestion')}
              </p>
              <Button
                disabled={
                  data.groupActivityDetails.group.participants?.length === 1
                }
                loading={startLoading}
                className={{ root: 'self-end mt-4 text-lg font-bold' }}
                onClick={() => startGroupActivity()}
                data={{ cy: 'start-group-activity' }}
              >
                {t('pwa.groupActivity.startCaps')}
              </Button>

              {data.groupActivityDetails.group.participants?.length === 1 && (
                <div className="p-2 mt-4 text-sm text-center text-red-500 bg-red-100 rounded">
                  {t.rich('pwa.groupActivity.minTwoPersons', {
                    br: () => <br />,
                  })}
                </div>
              )}
            </div>
          )}

          {data.groupActivityDetails.activityInstance && (
            <div className="py-4 lg:pt-0">
              <H1>{t('pwa.groupActivity.yourTasks')}</H1>
              <GroupActivityStack
                activityId={data.groupActivityDetails.activityInstance.id}
                stack={data.groupActivityDetails.stacks[0] as ElementStack}
                decisions={data.groupActivityDetails.activityInstance.decisions}
                submittedAt={dayjs(
                  data.groupActivityDetails.activityInstance
                    .decisionsSubmittedAt
                ).format('DD.MM.YYYY HH:mm:ss')}
              />
            </div>
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

export default GroupActivityDetails
