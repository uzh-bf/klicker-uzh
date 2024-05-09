import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

import { GroupActivity } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function ActivityInstanceLink({
  groupId,
  activity,
  label,
  ix,
}: {
  groupId: string
  activity: GroupActivity
  label: string
  ix: number
}) {
  const t = useTranslations()

  return (
    <Link
      href={`/group/${groupId}/activity/${activity.id}`}
      className="inline-flex items-center sm:hover:text-orange-700"
    >
      <Button
        className={{
          root: 'gap-2 text-left text-sm h-max py-0.5',
        }}
        data={{
          cy: `open-group-activity-${ix}`,
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
