import { Course } from '@klicker-uzh/graphql/dist/ops'
import { Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import GroupsLeaderboard from './GroupsLeaderboard'
import GroupsList from './GroupsList'
import IndividualLeaderboard from './IndividualLeaderboard'

function CourseGamificationInfos({ course }: { course: Course }) {
  const [tabValue, setTabValue] = useState('ind-leaderboard')
  const t = useTranslations()

  return (
    <div className="mt-8 w-full pl-2">
      <Tabs
        defaultValue="ind-leaderboard"
        value={tabValue}
        onValueChange={(newValue: string) => setTabValue(newValue)}
      >
        <Tabs.TabList>
          <Tabs.Tab
            key="tab-individual-leaderboard"
            value="ind-leaderboard"
            label={t('manage.course.courseLeaderboard')}
            className={{
              root: 'border border-solid',
              label: twMerge(
                'text-base',
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
                'text-base',
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
              label: twMerge('text-base', tabValue === 'groups' && 'font-bold'),
            }}
            data={{ cy: 'tab-groups' }}
          />
        </Tabs.TabList>
        <IndividualLeaderboard course={course} />
        <GroupsLeaderboard course={course} />
        <GroupsList
          courseId={course.id}
          groupCreationFinalized={course.randomAssignmentFinalized}
        />
      </Tabs>
    </div>
  )
}

export default CourseGamificationInfos
