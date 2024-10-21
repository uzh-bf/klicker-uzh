import { Course } from '@klicker-uzh/graphql/dist/ops'
import { Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import GroupsLeaderboard from './GroupsLeaderboard'
import GroupsList from './GroupsList'
import IndividualLeaderboard, {
  type InvididualLeaderboardEntry,
} from './IndividualLeaderboard'

interface CourseGamificationInfosProps {
  course: Omit<Course, 'leaderboard' | 'sessions'> & {
    leaderboard?: InvididualLeaderboardEntry[] | null
  }
  tabValue: string
  setTabValue: (newValue: string) => void
}

function CourseGamificationInfos({
  course,
  tabValue,
  setTabValue,
}: CourseGamificationInfosProps) {
  const t = useTranslations()

  return (
    <Tabs
      defaultValue="ind-leaderboard"
      value={tabValue}
      onValueChange={(newValue: string) => setTabValue(newValue)}
      className={{ root: 'flex-1 basis-1/3' }}
    >
      <Tabs.TabList>
        <Tabs.Tab
          key="tab-individual-leaderboard"
          value="ind-leaderboard"
          label={t('manage.course.courseLeaderboard')}
          className={{
            root: 'border border-solid',
            label: twMerge(
              'whitespace-nowrap text-base',
              tabValue === 'ind-leaderboard' && 'font-bold'
            ),
          }}
          data={{ cy: 'tab-ind-leaderboard' }}
        />
        <Tabs.Tab
          key="tab-group-leaderboard"
          value="group-leaderboard"
          label={t('manage.course.groupLeaderboard')}
          className={{
            root: 'border border-solid',
            label: twMerge(
              'whitespace-nowrap text-base',
              tabValue === 'group-leaderboard' && 'font-bold'
            ),
          }}
          data={{ cy: 'tab-group-leaderboard' }}
        />
        <Tabs.Tab
          key="groups"
          value="groups"
          label={t('manage.course.groups')}
          className={{
            root: 'border border-solid',
            label: twMerge(
              'whitespace-nowrap text-base',
              tabValue === 'groups' && 'font-bold'
            ),
          }}
          data={{ cy: 'tab-groups' }}
        />
      </Tabs.TabList>
      <IndividualLeaderboard
        leaderboard={course.leaderboard}
        courseName={course.name}
        numOfParticipants={course.numOfParticipants}
        numOfActiveParticipants={course.numOfActiveParticipants}
        averageActiveScore={course.averageActiveScore}
      />
      <GroupsLeaderboard />
      <GroupsList
        courseId={course.id}
        groupCreationFinalized={course.randomAssignmentFinalized}
      />
    </Tabs>
  )
}

export default CourseGamificationInfos
