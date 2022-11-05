import { useQuery } from '@apollo/client'
import { GroupActivityDetailsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'

function GroupActivityDetails() {
  const router = useRouter()

  const { data } = useQuery(GroupActivityDetailsDocument, {
    variables: {
      groupId: router.query.groupId,
      activityId: router.query.activityId,
    },
  })

  return <div>hello world</div>
}

export default GroupActivityDetails
