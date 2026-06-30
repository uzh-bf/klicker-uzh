import { SetStateAction } from 'react'
import GroupCreationBlock from './GroupCreationBlock'
import GroupJoinBlock from './GroupJoinBlock'
import PoolNotification from './PoolNotification'
import RandomGroupBlock from './RandomGroupBlock'

function GroupCreationActions({
  courseId,
  setSelectedTab,
  inRandomGroupPool,
  onCourseOverviewChanged,
}: {
  courseId: string
  setSelectedTab: (value: SetStateAction<string>) => void
  inRandomGroupPool: boolean
  onCourseOverviewChanged?: () => void | Promise<void>
}) {
  if (inRandomGroupPool) {
    return (
      <PoolNotification
        courseId={courseId}
        onCourseOverviewChanged={onCourseOverviewChanged}
      />
    )
  }

  return (
    <div className="grid h-max grid-cols-1 gap-4 md:grid-cols-3">
      <GroupCreationBlock
        courseId={courseId}
        setSelectedTab={setSelectedTab}
        onCourseOverviewChanged={onCourseOverviewChanged}
      />
      <GroupJoinBlock
        courseId={courseId}
        setSelectedTab={setSelectedTab}
        onCourseOverviewChanged={onCourseOverviewChanged}
      />
      <RandomGroupBlock
        courseId={courseId}
        onCourseOverviewChanged={onCourseOverviewChanged}
      />
    </div>
  )
}

export default GroupCreationActions
