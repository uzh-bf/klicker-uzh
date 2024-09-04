import { Course } from '@klicker-uzh/graphql/dist/ops'
import { Tabs } from '@uzh-bf/design-system'

function GroupsLeaderboard({ course }: { course: Course }) {
  return (
    <Tabs.TabContent
      value="group-leaderboard"
      className={{ root: 'p-2' }}
    ></Tabs.TabContent>
  )
}

export default GroupsLeaderboard
