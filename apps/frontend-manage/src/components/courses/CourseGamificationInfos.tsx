import { Course } from '@klicker-uzh/graphql/dist/ops'
import { Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import GroupsLeaderboard from './GroupsLeaderboard'
import GroupsList from './GroupsList'
import IndividualLeaderboard from './IndividualLeaderboard'

interface CourseGamificationInfosProps {
  course: Omit<Course, 'liveQuizzes'>
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
        courseStart={course.startDate}
        courseEnd={course.endDate}
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
