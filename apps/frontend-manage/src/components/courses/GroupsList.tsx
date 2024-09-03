import { useMutation, useQuery } from '@apollo/client'
import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseGroupsDocument,
  ManualRandomGroupAssignmentsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Tabs, UserNotification } from '@uzh-bf/design-system'
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

  // count the number of groups with only one participant
  const groupsOfOne = groups.filter(
    (group) => group.participants?.length === 1
  ).length
  const randomAssignmentNotPossible =
    (pool.length === 1 && groupsOfOne === 0) ||
    (pool.length === 0 && groupsOfOne === 1)

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
        {randomAssignmentNotPossible && (
          <UserNotification
            type="warning"
            message={t('manage.course.randomGroupsNotPossible')}
          />
        )}
        <Button
          className={{
            root: 'bg-primary-80 mt-2 h-8 w-max gap-4 self-end text-white',
          }}
          // TODO: hide functionality behind confirmation modal
          onClick={async () =>
            await manualRandomGroupAssignments({
              variables: { courseId: courseId },
            })
          }
          loading={randomGroupCreationLoading}
          disabled={randomAssignmentNotPossible}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faShuffle} />
          </Button.Icon>
          <Button.Label>{t('manage.course.assignRandomGroups')}</Button.Label>
        </Button>
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
    </Tabs.TabContent>
  )
}

export default GroupsList
