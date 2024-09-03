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

function GroupsList({ courseId }: { courseId: string }) {
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
              root: twMerge(
                'bg-primary-80 mt-2 h-8 w-max gap-4 self-end text-white',
                randomAssignmentNotPossible &&
                  'hover:bg-primar-80 cursor-not-allowed bg-opacity-50'
              ),
            }}
            onClick={() => setOpen(true)}
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
      <AssignmentConfirmationModal
        courseId={courseId}
        open={open}
        setOpen={setOpen}
      />
    </>
  )
}

export default GroupsList
