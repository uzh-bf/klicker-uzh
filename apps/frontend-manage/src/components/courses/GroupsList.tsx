import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import { Button, TabContent, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../lib/trpc'
import ParticipantListEntry from './ParticipantListEntry'
import AssignmentConfirmationModal from './groups/AssignmentConfirmationModal'

function GroupsList({
  courseId,
  groupCreationFinalized,
  actionsDisabled,
}: {
  courseId: string
  groupCreationFinalized: boolean
  actionsDisabled: boolean
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [isGroupCreationFinalized, setIsGroupCreationFinalized] = useState(
    groupCreationFinalized
  )

  useEffect(() => {
    setIsGroupCreationFinalized(groupCreationFinalized)
  }, [groupCreationFinalized])

  const { data } = trpc.course.groups.useQuery({ courseId })

  const pool = data?.courseGroups?.groupAssignmentPoolEntries ?? []
  const groups = data?.courseGroups?.participantGroups ?? []

  // count the number of groups with only one participant
  const groupsOfOne = groups.filter(
    (group) => group.participants?.length === 1
  ).length
  const randomAssignmentNotPossible =
    (pool.length === 0 && groupsOfOne === 0) ||
    (pool.length === 1 && groupsOfOne === 0) ||
    (pool.length === 0 && groupsOfOne === 1)

  return (
    <>
      <TabContent
        value="groups"
        className={{ root: '@container flex flex-col gap-2 p-2' }}
      >
        <div className="font-bold">
          {t('manage.course.poolForRandomAssignment')}
        </div>

        {pool.length > 0 && (
          <div
            className="@xl:grid-cols-2 grid"
            data-cy="random-group-assignment-pool"
          >
            {pool.map((entry) =>
              entry.participant ? (
                <ParticipantListEntry
                  participant={entry.participant}
                  key={entry.id}
                />
              ) : null
            )}
          </div>
        )}

        {!isGroupCreationFinalized && randomAssignmentNotPossible && (
          <UserNotification
            type="warning"
            message={t('manage.course.randomGroupsNotPossible')}
          />
        )}
        {isGroupCreationFinalized && (
          <UserNotification
            type="warning"
            message={t('manage.course.groupAssignmentFinalizedMessage')}
          />
        )}

        {!isGroupCreationFinalized && !actionsDisabled && (
          <Button
            primary
            className={{ root: 'my-1 h-8 w-max self-end' }}
            onClick={() => setOpen(true)}
            disabled={randomAssignmentNotPossible}
            data={{ cy: 'assign-random-groups' }}
          >
            <Button.Icon icon={faShuffle} />
            <Button.Label>{t('manage.course.assignRandomGroups')}</Button.Label>
          </Button>
        )}

        <div className="@xl:grid-cols-2 grid flex-1 gap-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="border-uzh-grey-80 rounded border p-2"
            >
              <div className="font-bold">{group.name}</div>
              {group.participants?.map((participant) => (
                <ParticipantListEntry
                  participant={participant}
                  key={participant.id}
                />
              ))}
            </div>
          ))}
        </div>
      </TabContent>
      {open && (
        <AssignmentConfirmationModal
          courseId={courseId}
          onAssigned={() => setIsGroupCreationFinalized(true)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default GroupsList
