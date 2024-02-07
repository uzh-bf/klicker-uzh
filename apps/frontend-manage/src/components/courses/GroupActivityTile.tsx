import { GroupActivity } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface GroupActivityTileTileProps {
  courseId: string
  groupActivity: Partial<GroupActivity> & Pick<GroupActivity, 'id' | 'name'>
}

function GroupActivityTile({
  courseId,
  groupActivity,
}: GroupActivityTileTileProps) {
  const t = useTranslations()

  const router = useRouter()

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/quiz/${groupActivity.id}/`

  return (
    <div
      className="flex flex-col justify-between p-2 border border-solid rounded w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80"
      data-cy={`group-activity-${groupActivity.name}`}
    >
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {groupActivity.name || ''}
          </Ellipsis>
        </div>
      </div>
    </div>
  )
}

export default GroupActivityTile
