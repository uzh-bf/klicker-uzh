import {
  faCalendar,
  faCheck,
  faExternalLink,
  faSync,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  QuestionInstance,
  SessionBlockStatus,
  SessionBlock as SessionBlockType,
} from '@klicker-uzh/graphql/dist/ops'
import { Countdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface SessionBlockProps {
  className?: string
  active: boolean
  block: SessionBlockType
}

const ICON_MAP = {
  [SessionBlockStatus.Executed]: faCheck,
  [SessionBlockStatus.Scheduled]: faCalendar,
  [SessionBlockStatus.Active]: faSync,
}

function SessionBlock({
  className,
  active,
  block,
}: SessionBlockProps): React.ReactElement {
  const t = useTranslations()
  const untilExpiration = useMemo(
    () =>
      block.expiresAt
        ? dayjs(block.expiresAt).add(20, 'second').diff(dayjs(), 'second')
        : block.timeLimit,
    [block.expiresAt, block.timeLimit]
  )

  return (
    <div
      className={twMerge(
        className,
        'bg-uzh-grey-40 p-4 rounded min-w-[150px]',
        active && 'bg-green-300'
      )}
    >
      <div
        className={twMerge(
          'flex flex-row justify-between text-gray-700 font-bold'
        )}
      >
        <div>
          <FontAwesomeIcon icon={ICON_MAP[block.status]} />
        </div>
        <div>{t('manage.cockpit.blockN', { number: block.order! + 1 })}</div>
        {untilExpiration && (
          <Countdown
            isStatic={!block.expiresAt}
            countdownDuration={
              block.status !== SessionBlockStatus.Executed ? untilExpiration : 0
            }
            size={25}
            strokeWidth={3}
            className={{ root: 'text-xs' }}
          />
        )}
      </div>
      {block.instances?.map((instance: QuestionInstance) => (
        <div key={instance.id}>
          <Link
            href={`/questions/${instance.questionData.id}`}
            className="text-sm sm:hover:text-slate-700"
            target="_blank"
          >
            {instance.questionData.name}{' '}
            <FontAwesomeIcon className="ml-1 text-xs" icon={faExternalLink} />
          </Link>
        </div>
      ))}
    </div>
  )
}

export default SessionBlock
