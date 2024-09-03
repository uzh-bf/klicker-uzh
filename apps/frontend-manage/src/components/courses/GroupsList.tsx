import { useMutation, useQuery } from '@apollo/client'
import {
  GetCourseGroupsDocument,
  ManualRandomGroupAssignmentsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function GroupsList({ courseId }: { courseId: string }) {
  const t = useTranslations()

  const { data } = useQuery(GetCourseGroupsDocument, {
    variables: { courseId: courseId },
  })
  const [
    manualRandomGroupAssignments,
    { loading: randomGroupCreationLoading },
  ] = useMutation(ManualRandomGroupAssignmentsDocument)

  const pool = data?.getCourseGroups?.groupAssignmentPoolEntries ?? []
  const groups = data?.getCourseGroups?.participantGroups ?? []

  return (
    <Tabs.TabContent value="groups" className={{ root: 'p-2' }}>
      <div>
        <div>POOL</div>
        {pool.map((entry) => entry.participant?.id)}
      </div>
      <div>
        <div>GROUPS</div>
        {groups.map((group) => (
          <div key={group.id}>
            <H3>{group.name}</H3>
            {group.participants?.map((participant) => (
              <div key={participant.id}>{participant.id}</div>
            ))}
          </div>
        ))}
      </div>

      <Button
        className={{
          root: 'bg-primary-80 float-right mt-4 w-max self-end text-white',
        }}
        onClick={async () =>
          await manualRandomGroupAssignments({
            variables: { courseId: courseId },
          })
        }
        loading={randomGroupCreationLoading}
      >
        {t('manage.course.assignRandomGroups')}
      </Button>
    </Tabs.TabContent>
  )
}

export default GroupsList
