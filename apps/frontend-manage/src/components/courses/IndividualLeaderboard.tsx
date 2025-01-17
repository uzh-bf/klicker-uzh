import { LeaderboardEntry } from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import { Tabs, UserNotification } from '@uzh-bf/design-system'
import { TableCell } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'

export type InvididualLeaderboardEntry = Omit<
  LeaderboardEntry,
  'level' | 'participantId' | 'participation'
>

interface IndividualLeaderboardProps {
  leaderboard?: InvididualLeaderboardEntry[] | null
  courseName: string
  numOfParticipants?: number | null
  numOfActiveParticipants?: number | null
  averageActiveScore?: number | null
}

function IndividualLeaderboard({
  leaderboard,
  courseName,
  numOfParticipants,
  numOfActiveParticipants,
  averageActiveScore,
}: IndividualLeaderboardProps) {
  const t = useTranslations()

  return (
    <Tabs.TabContent value="ind-leaderboard" className={{ root: 'h-full p-2' }}>
      <UserNotification
        message={t('manage.course.emailsInLeaderboardExport')}
        className={{ root: 'mb-3' }}
      />
      <DataTable
        isPaginated
        columns={[
          {
            accessorKey: 'rank',
            header: t('shared.leaderboard.rank'),
            displayName: t('shared.leaderboard.rank'),
          },
          {
            accessorKey: 'username',
            header: t('shared.leaderboard.username'),
            displayName: t('shared.leaderboard.username'),
          },
          {
            accessorKey: 'email',
            header: t('shared.leaderboard.email'),
            csvOnly: true,
            displayName: t('shared.leaderboard.email'),
          },
          {
            accessorKey: 'score',
            header: t('shared.leaderboard.points'),
            displayName: t('shared.leaderboard.points'),
          },
        ]}
        data={leaderboard ?? []}
        csvFilename={`${courseName.replace(' ', '-')}_course_leaderboard`}
        className={{
          tableHeader: 'h-7 p-2',
          tableCell: 'h-7 p-2',
        }}
        footerContent={
          <TableCell
            colSpan={3}
            className="px-1 py-2 text-right text-slate-700"
          >
            <div>
              {t('manage.course.participantsLeaderboard', {
                number: numOfActiveParticipants,
              })}
              /{numOfParticipants}
            </div>
            <div>
              {t('manage.course.avgPoints', {
                points: averageActiveScore?.toFixed(2),
              })}
            </div>
          </TableCell>
        }
      />
    </Tabs.TabContent>
  )
}

export default IndividualLeaderboard
