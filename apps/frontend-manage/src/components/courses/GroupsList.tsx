import { useQuery } from '@apollo/client'
import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetCourseGroupsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Tabs, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ParticipantListEntry from './ParticipantListEntry'
import AssignmentConfirmationModal from './groups/AssignmentConfirmationModal'

function GroupsList({
  courseId,
  groupCreationFinalized,
}: {
  courseId: string
  groupCreationFinalized: boolean
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
      <Tabs.TabContent
        value="groups"
        className={{ root: 'flex h-full flex-col gap-2 p-2' }}
      >
        <div className="font-bold">
          {t('manage.course.poolForRandomAssignment')}
        </div>

        {pool.length > 0 && (
          <div className="grid grid-cols-2">
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

        {!groupCreationFinalized && (
          <Button
            className={{
              root: twMerge(
                'bg-primary-80 h-8 w-max gap-4 self-end text-white',
                randomAssignmentNotPossible &&
                  'hover:bg-primar-40 bg-primary-40 cursor-not-allowed bg-opacity-50'
              ),
            }}
            onClick={() => setOpen(true)}
            disabled={randomAssignmentNotPossible}
            data={{ cy: 'assign-random-groups' }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faShuffle} />
            </Button.Icon>
            <Button.Label>{t('manage.course.assignRandomGroups')}</Button.Label>
          </Button>
        )}

        <div className="grid max-h-[500px] flex-1 grid-cols-2 gap-2 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.id} className="rounded border p-2">
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
      </Tabs.TabContent>
      <AssignmentConfirmationModal
        courseId={courseId}
        open={open}
        setOpen={setOpen}
      />
    </>
  )
}

export default GroupsList
