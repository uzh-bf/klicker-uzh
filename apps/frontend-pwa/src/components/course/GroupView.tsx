import { useMutation } from '@apollo/client'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AddMessageToGroupDocument,
  GetCourseOverviewDataDocument,
  GroupActivity,
  GroupActivityInstance,
  GroupMessage,
  LeaveParticipantGroupDocument,
  Participant,
  ParticipantGroup,
  Participation,
} from '@klicker-uzh/graphql/dist/ops'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import {
  Button,
  FormikTextareaField,
  H3,
  Tabs,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Rank1Img from 'public/rank1.svg'
import Rank2Img from 'public/rank2.svg'
import Rank3Img from 'public/rank3.svg'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import GroupActivityList from '../groupActivity/GroupActivityList'
import GroupVisualization from '../participant/groups/GroupVisualization'
import EditableGroupName from './EditableGroupName'

interface GroupViewProps {
  group: Omit<ParticipantGroup, 'participants' | 'messages'> & {
    participants?: Omit<Participant, 'isActive' | 'locale' | 'xp'>[] | null
    messages?: Omit<GroupMessage, 'group'>[] | null
  }
  participation: Omit<Participation, 'completedMicroLearnings'>
  participant: Omit<Participant, 'isActive' | 'locale' | 'participantGroups'>
  groupActivities: Omit<GroupActivity, 'name' | 'status'>[]
  groupActivityInstances: Record<string, GroupActivityInstance>
  courseId: string
  maxGroupSize: number
  groupDeadlineDate: string
  isGroupDeadlinePassed: boolean
  setSelectedTab: (value: string) => void
}

function GroupView({
  group,
  participation,
  participant,
  groupActivities,
  groupActivityInstances,
  courseId,
  maxGroupSize,
  groupDeadlineDate,
  isGroupDeadlinePassed,
  setSelectedTab,
}: GroupViewProps) {
  const t = useTranslations()
  const [leaveParticipantGroup] = useMutation(LeaveParticipantGroupDocument)

  const [addMessageToGroup] = useMutation(AddMessageToGroupDocument)

  return (
    <Tabs.TabContent key={group.id} value={group.id}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap gap-4">
          <div className="flex flex-1 flex-col">
            <EditableGroupName groupId={group.id} groupName={group.name} />
            {(!participation.isActive ||
              group.participants!.length === 1 ||
              group.participants!.length === maxGroupSize) && (
              <div className="mb-2 flex flex-col gap-2">
                {!participation.isActive && (
                  <UserNotification
                    type="warning"
                    message={t('pwa.groupActivity.joinLeaderboard')}
                  />
                )}
                {group.participants!.length === 1 && (
                  <UserNotification
                    type="info"
                    message={t(
                      'pwa.groupActivity.singleParticipantAutomaticAssignment',
                      {
                        groupFormationDeadline:
                          dayjs(groupDeadlineDate).format('DD.MM.YYYY HH:mm'),
                      }
                    )}
                  />
                )}
                {group.participants!.length === maxGroupSize && (
                  <UserNotification
                    type="info"
                    message={t('pwa.groupActivity.maxNumberOfGroupMembers')}
                  />
                )}
              </div>
            )}
            <div className="mb-1 self-end text-sm italic">
              {t('pwa.groupActivity.nOfMaxParticipants', {
                numParticipants: group.participants!.length,
                maxParticipants: maxGroupSize,
              })}
            </div>
            <Leaderboard
              leaderboard={
                group.participants!.map((participant) => {
                  return {
                    ...participant,
                    score: participant.score ?? 0,
                    rank: participant.rank ?? 1,
                    level: participant.level ?? 1,
                  }
                }) ?? []
              }
              participant={participant}
              onLeave={
                isGroupDeadlinePassed
                  ? undefined
                  : () => {
                      leaveParticipantGroup({
                        variables: {
                          courseId,
                          groupId: group.id,
                        },
                        refetchQueries: [
                          {
                            query: GetCourseOverviewDataDocument,
                            variables: { courseId: courseId },
                          },
                        ],
                      })

                      setSelectedTab('global')
                    }
              }
              hidePodium
              podiumImgSrc={{
                rank1: Rank1Img,
                rank2: Rank2Img,
                rank3: Rank3Img,
              }}
            />
            <div className="mt-6 w-60 self-end text-sm text-slate-600">
              <div className="flex flex-row justify-between">
                <div>{t('pwa.courses.membersScore')}</div>
                <div>{group.averageMemberScore}</div>
              </div>
              <div className="flex flex-row justify-between">
                <div>{t('pwa.courses.groupActivityScore')}</div>
                <div>{group.groupActivityScore}</div>
              </div>
              <div className="flex flex-row justify-between font-bold">
                <div>{t('pwa.courses.totalScore')}</div>
                <div>{group.score}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center md:flex-none">
            <H3 className={{ root: 'self-end' }}>{group.code}</H3>
            <GroupVisualization
              groupName={group.name}
              participants={group.participants!}
            />
          </div>
        </div>

        {(groupActivities.length ?? -1) > 0 && (
          <GroupActivityList
            groupId={group.id}
            groupActivities={groupActivities}
            groupActivityInstances={groupActivityInstances}
          />
        )}

        <div className="mt-4">
          <H3 className={{ root: 'border-b' }}>
            {t('shared.generic.groupMessages')}
          </H3>

          <div className="bg-uzh-grey-20 mt-2 rounded px-2 pb-2">
            <div
              className="mb-2 flex max-h-80 min-h-40 flex-col-reverse gap-1.5 overflow-scroll"
              data-cy="group-messages"
            >
              {group.messages?.map((message, ix) => {
                const ownMessage = message.participant?.id === participant.id
                const nextMessageSameUser =
                  ix + 1 < group.messages!.length &&
                  group.messages![ix + 1]?.participant?.id ===
                    message.participant?.id

                return (
                  <div
                    key={message.id}
                    className={twMerge(
                      'flex w-[80%] flex-col gap-0.5 self-start',
                      ownMessage && 'self-end'
                    )}
                  >
                    {!nextMessageSameUser && (
                      <div
                        className={twMerge(
                          'mt-1.5 flex flex-row items-end gap-1 text-xs text-slate-600',
                          ownMessage && 'justify-end'
                        )}
                      >
                        {message.participant?.avatar && (
                          <Image
                            key={message.participant.avatar}
                            src={
                              message.participant.avatar
                                ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${message.participant.avatar}.svg`
                                : '/user-solid.svg'
                            }
                            alt=""
                            height={25}
                            width={25}
                            className={twMerge(
                              'order-1',
                              ownMessage && 'order-2'
                            )}
                          />
                        )}
                        <div
                          className={twMerge(
                            'order-2',
                            ownMessage && 'order-1'
                          )}
                        >
                          {message.participant?.username}
                        </div>
                      </div>
                    )}
                    <div
                      className={twMerge(
                        'w-full rounded border border-gray-300 bg-white px-1 py-0.5',
                        ownMessage && 'bg-uzh-blue-20'
                      )}
                    >
                      <div className="flex flex-col">
                        <div className="text-sm">{message.content}</div>
                        <div className="self-end whitespace-nowrap text-xs text-slate-600">
                          {dayjs(message.createdAt).format('DD.MM.YYYY HH:mm')}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <Formik
              validateOnMount
              initialValues={{
                content: '',
              }}
              validationSchema={Yup.object({
                content: Yup.string().required(t('pwa.groups.messageRequired')),
              })}
              onSubmit={async (values, { resetForm, setSubmitting }) => {
                await addMessageToGroup({
                  variables: { groupId: group.id, content: values.content },
                  refetchQueries: [
                    {
                      query: GetCourseOverviewDataDocument,
                      variables: { courseId },
                    },
                  ],
                })
                resetForm()
                setSubmitting(false)
              }}
            >
              {({ isValid, isSubmitting }) => (
                <Form className="flex flex-row items-center gap-1.5">
                  <FormikTextareaField
                    name="content"
                    className={{ input: 'text-sm' }}
                    data={{ cy: 'group-message-textarea' }}
                  />
                  <Button
                    type="submit"
                    className={{
                      root: twMerge(
                        'bg-primary-100 flex h-8 w-8 items-center justify-center rounded-full text-white',
                        (!isValid || isSubmitting) &&
                          'bg-primary-20 cursor-not-allowed'
                      ),
                    }}
                    data={{
                      cy: 'group-message-submit',
                    }}
                    disabled={!isValid || isSubmitting}
                    loading={isSubmitting}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} className="mr-0.5" />
                  </Button>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>
    </Tabs.TabContent>
  )
}

export default GroupView
