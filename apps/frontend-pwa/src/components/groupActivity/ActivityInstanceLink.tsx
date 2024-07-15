import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

import { GroupActivity } from '@klicker-uzh/graphql/dist/ops'

function ActivityInstanceLink({
  groupId,
  activity,
  label,
}: {
  groupId: string
  activity: GroupActivity
  label: string
}) {
  return (
    <Link
      href={`/group/${groupId}/activity/${activity.id}`}
      className="inline-flex items-center hover:text-orange-700"
    >
      <Button
        className={{
          root: 'gap-2 text-left text-sm h-max py-0.5',
        }}
        data={{
          cy: `open-group-activity-${activity.displayName}`,
        }}
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
