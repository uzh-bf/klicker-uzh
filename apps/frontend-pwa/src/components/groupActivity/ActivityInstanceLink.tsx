import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { GroupActivity } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

function ActivityInstanceLink({
  groupId,
  activity,
  label,
  data,
}: {
  groupId: string
  activity: Omit<GroupActivity, 'name' | 'status'>
  label: string
  data: { cy?: string; test?: string }
}) {
  return (
    <Link
      href={`/group/${groupId}/activity/${activity.id}`}
      className="inline-flex"
    >
      <Button className={{ root: 'h-6 rounded text-sm' }} data={data}>
        <Button.Icon icon={faExternalLink} className={{ root: 'h-3 w-3' }} />
        <Button.Label>{label}</Button.Label>
      </Button>
    </Link>
  )
}

export default ActivityInstanceLink
