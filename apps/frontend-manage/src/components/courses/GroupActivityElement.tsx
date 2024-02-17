import { GroupActivity } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'

interface GroupActivityElementProps {
  groupActivity: Partial<GroupActivity> & Pick<GroupActivity, 'id' | 'name'>
}

function GroupActivityElement({ groupActivity }: GroupActivityElementProps) {
  return (
    <div
      className="w-full p-2 border border-solid rounded border-uzh-grey-80"
      data-cy={`groupActivity-${groupActivity.name}`}
    >
      <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
        {groupActivity.name || ''}
      </Ellipsis>
    </div>
  )
}

export default GroupActivityElement
