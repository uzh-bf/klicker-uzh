import TableWithDownload from '@components/common/TableWithDownload'
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

      <TableWithDownload
        columns={[
          {
            id: 'rank',
            label: t('shared.leaderboard.rank'),
          },
          {
            id: 'username',
            label: t('shared.leaderboard.username'),
          },
          {
            id: 'email',
            label: t('shared.leaderboard.email'),
          },
          {
            id: 'score',
            label: t('shared.leaderboard.points'),
          },
        ]}
        itemIdentifier="id"
        items={course.leaderboard ?? []}
        csvFilename={`${course.name.replace(' ', '-')}_leaderboard`}
      />
    </Tabs.TabContent>
  )
}

export default IndividualLeaderboard
