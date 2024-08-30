import { SetStateAction } from 'react'
import GroupCreationBlock from './GroupCreationBlock'
import GroupJoinBlock from './GroupJoinBlock'
import PoolNotification from './PoolNotification'
import RandomGroupBlock from './RandomGroupBlock'

function GroupCreationActions({
  courseId,
  setSelectedTab,
  inRandomGroupPool,
}: {
  courseId: string
  setSelectedTab: (value: SetStateAction<string>) => void
  inRandomGroupPool: boolean
}) {
  if (inRandomGroupPool) {
    return <PoolNotification courseId={courseId} />
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <GroupCreationBlock courseId={courseId} setSelectedTab={setSelectedTab} />
      <GroupJoinBlock courseId={courseId} setSelectedTab={setSelectedTab} />
      <RandomGroupBlock courseId={courseId} />
    </div>
  )
}

export default GroupCreationActions
