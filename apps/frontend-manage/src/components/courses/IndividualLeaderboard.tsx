import TableWithDownload from '@components/common/TableWithDownload'
import { Course } from '@klicker-uzh/graphql/dist/ops'
import { Tabs } from '@uzh-bf/design-system'
import { TableHead } from '@uzh-bf/design-system/dist/future'
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
        head={
          <>
            <TableHead className="w-[100px]">
              {t('shared.leaderboard.rank')}
            </TableHead>
            <TableHead>{t('shared.leaderboard.username')}</TableHead>
            {/* <TableHead>{t('shared.leaderboard.email')}</TableHead> */}
            <TableHead>{t('shared.leaderboard.points')}</TableHead>
          </>
        }
        items={
          course.leaderboard?.map((item) => ({
            ...item,
            email: item.username + '@klicker.com',
          })) ?? []
        }
        onDownload={() => null}
      />
    </Tabs.TabContent>
  )
}

export default IndividualLeaderboard
