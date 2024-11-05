import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

import { GroupActivity } from '@klicker-uzh/graphql/dist/ops'

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
      className="inline-flex items-center hover:text-orange-700"
    >
      <Button
        className={{
          root: 'h-max gap-2 py-0.5 text-left text-sm',
        }}
        data={data}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faExternalLink} className="h-3 w-3" />
        </Button.Icon>
        <Button.Label>
          <div>{label}</div>
        </Button.Label>
      </Button>
    </Link>
  )
}

export default ActivityInstanceLink
