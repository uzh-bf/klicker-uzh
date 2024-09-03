import { useMutation, useQuery } from '@apollo/client'
import {
  GetCourseGroupsDocument,
  ManualRandomGroupAssignmentsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ParticipantListEntry from './ParticipantListEntry'

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
    <Tabs.TabContent
      value="groups"
      className={{ root: 'flex flex-col gap-3 p-2' }}
    >
      <div>
        <div className="font-bold">
          {t('manage.course.poolForRandomAssignment')}
        </div>
        {pool.map((entry) => (
          <ParticipantListEntry
            participant={entry.participant!}
            key={entry.id}
          />
        ))}
      </div>
      {groups.map((group) => (
        <div key={group.id}>
          <div className="font-bold">{group.name}</div>
          {group.participants?.map((participant) => (
            <ParticipantListEntry
              participant={participant}
              key={participant.id}
            />
          ))}
        </div>
      ))}

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
