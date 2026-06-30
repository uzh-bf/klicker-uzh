import { Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { RouterOutputs } from '../../lib/trpc'
import GroupsLeaderboard from './GroupsLeaderboard'
import GroupsList from './GroupsList'
import IndividualLeaderboard from './IndividualLeaderboard'

type CourseDetail = NonNullable<RouterOutputs['course']['detail']['course']>

interface CourseGamificationInfosProps {
  course: CourseDetail
  tabValue: string
  setTabValue: (newValue: string) => void
}

function CourseGamificationInfos({
  course,
  tabValue,
  setTabValue,
}: CourseGamificationInfosProps) {
  const t = useTranslations()
  const courseStart = course.startDate.toISOString()
  const courseEnd = course.endDate.toISOString()

  return (
    <Tabs
      defaultValue="ind-leaderboard"
      value={tabValue}
      onValueChange={(newValue: string) => setTabValue(newValue)}
      tabs={[
        {
          id: 'tab-individual-leaderboard',
          value: 'ind-leaderboard',
          label: t('manage.course.courseLeaderboard'),
          data: { cy: 'tab-ind-leaderboard' },
        },
        {
          id: 'tab-group-leaderboard',
          value: 'group-leaderboard',
          label: t('manage.course.groupLeaderboard'),
          data: { cy: 'tab-group-leaderboard' },
          disabled: !course.isGroupCreationEnabled,
        },
        {
          id: 'tab-groups',
          value: 'groups',
          label: t('manage.course.groups'),
          data: { cy: 'tab-groups' },
          disabled: !course.isGroupCreationEnabled,
        },
      ]}
      className={{ root: 'flex-1 basis-2/5' }}
    >
      <IndividualLeaderboard
        courseName={course.name}
        courseId={course.id}
        courseStart={courseStart}
        courseEnd={courseEnd}
        numOfParticipants={course.numOfParticipants}
      />
      <GroupsLeaderboard />
      <GroupsList
        courseId={course.id}
        groupCreationFinalized={course.randomAssignmentFinalized}
        actionsDisabled={!course.isEditor}
      />
    </Tabs>
  )
}

export default CourseGamificationInfos
