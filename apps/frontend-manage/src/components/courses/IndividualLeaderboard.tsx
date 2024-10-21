import DataTable from '@components/common/DataTable'
import { LeaderboardEntry } from '@klicker-uzh/graphql/dist/ops'
import { Tabs } from '@uzh-bf/design-system'
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
      <DataTable
        isPaginated
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
        data={leaderboard ?? []}
        csvFilename={`${courseName.replace(' ', '-')}_leaderboard`}
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
