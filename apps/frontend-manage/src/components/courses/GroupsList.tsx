import { useQuery } from '@apollo/client'
import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import { GetCourseGroupsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, TabsLegacy, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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

  const { data } = useQuery(GetCourseGroupsDocument, {
    variables: { courseId: courseId },
  })

  const pool = data?.getCourseGroups?.groupAssignmentPoolEntries ?? []
  const groups = data?.getCourseGroups?.participantGroups ?? []

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
      <TabsLegacy.TabContent
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
            {pool.map((entry) => (
              <ParticipantListEntry
                participant={entry.participant!}
                key={entry.id}
              />
            ))}
          </div>
        )}

        {!groupCreationFinalized && randomAssignmentNotPossible && (
          <UserNotification
            type="warning"
            message={t('manage.course.randomGroupsNotPossible')}
          />
        )}
        {groupCreationFinalized && (
          <UserNotification
            type="warning"
            message={t('manage.course.groupAssignmentFinalizedMessage')}
          />
        )}

        {!groupCreationFinalized && !actionsDisabled && (
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
      </TabsLegacy.TabContent>
      <AssignmentConfirmationModal
        courseId={courseId}
        open={open}
        setOpen={setOpen}
      />
    </>
  )
}

export default GroupsList
