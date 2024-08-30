import { SetStateAction } from 'react'
import GroupCreationBlock from './GroupCreationBlock'
import GroupJoinBlock from './GroupJoinBlock'
import RandomGroupBlock from './RandomGroupBlock'

function GroupCreationActions({
  courseId,
  setSelectedTab,
}: {
  courseId: string
  setSelectedTab: (value: SetStateAction<string>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <GroupCreationBlock courseId={courseId} setSelectedTab={setSelectedTab} />
      <GroupJoinBlock courseId={courseId} setSelectedTab={setSelectedTab} />
      <RandomGroupBlock />
    </div>
  )
}

export default GroupCreationActions
