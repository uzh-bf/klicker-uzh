import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

type LinkActivity = {
  id: string
}

function ActivityInstanceLink({
  groupId,
  activity,
  label,
  data,
}: {
  groupId: string
  activity: LinkActivity
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
