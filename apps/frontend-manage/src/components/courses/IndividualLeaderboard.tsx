import DataTable from '@components/common/DataTable'
import { Course } from '@klicker-uzh/graphql/dist/ops'
import { Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function IndividualLeaderboard({ course }: { course: Course }) {
  const t = useTranslations()

  return (
    <Tabs.TabContent value="ind-leaderboard" className={{ root: 'p-2' }}>
      <div className="text-md mb-2 flex flex-col items-end text-slate-600">
        <div>
          {t('manage.course.participantsLeaderboard', {
            number: course.numOfActiveParticipants,
          })}
          /{course.numOfParticipants}
        </div>
        <div>
          {t('manage.course.avgPoints', {
            points: course.averageActiveScore?.toFixed(2),
          })}
        </div>
      </div>

      <DataTable
        columns={[
          {
            accessorKey: 'rank',
            header: t('shared.leaderboard.rank'),
          },
          {
            accessorKey: 'username',
            header: t('shared.leaderboard.username'),
          },
          {
            accessorKey: 'email',
            header: t('shared.leaderboard.email'),
            csvOnly: true,
          },
          {
            accessorKey: 'score',
            header: t('shared.leaderboard.points'),
          },
        ]}
        data={course.leaderboard ?? []}
        csvFilename={`${course.name.replace(' ', '-')}_leaderboard`}
      />
    </Tabs.TabContent>
  )
}

export default IndividualLeaderboard
