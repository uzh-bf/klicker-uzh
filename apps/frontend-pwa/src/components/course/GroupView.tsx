import { useMutation } from '@apollo/client'
import {
  GetCourseOverviewDataDocument,
  GroupActivity,
  GroupActivityInstance,
  LeaveParticipantGroupDocument,
  Participant,
  ParticipantGroup,
  Participation,
} from '@klicker-uzh/graphql/dist/ops'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import { H3, Tabs, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Rank1Img from 'public/rank1.svg'
import Rank2Img from 'public/rank2.svg'
import Rank3Img from 'public/rank3.svg'
import GroupActivityList from '../groupActivity/GroupActivityList'
import GroupVisualization from '../participant/groups/GroupVisualization'

interface GroupViewProps {
  group: Omit<ParticipantGroup, 'participants'> & {
    participants?: Omit<Participant, 'isActive' | 'locale' | 'xp'>[] | null
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

  return (
    <Tabs.TabContent key={group.id} value={group.id}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap gap-4">
          <div className="flex flex-1 flex-col">
            <H3>
              {t('shared.generic.group')} {group.name}
            </H3>
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
      </div>
    </Tabs.TabContent>
  )
}

export default GroupView
