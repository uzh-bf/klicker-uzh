import {
  faCalendar,
  faCheck,
  faExternalLink,
  faSync,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LiveQuizCountdown from './LiveQuizCountdown'

export const ElementBlockStatus = {
  Active: 'ACTIVE',
  Executed: 'EXECUTED',
  Scheduled: 'SCHEDULED',
} as const

type ElementBlockStatusType =
  (typeof ElementBlockStatus)[keyof typeof ElementBlockStatus]

type QuizTimelineInstance = {
  id: number
  type: string
  elementType: string
  elementData: { elementId: number | null; name: string | null }
}

export type QuizTimelineBlock = {
  id: number
  numOfParticipants?: number | null
  order?: number | null
  status: ElementBlockStatusType
  expiresAt?: Date | string | null
  timeLimit?: number | null
  randomSelection?: number | null
  execution?: number | null
  elements?: QuizTimelineInstance[] | null
}

interface LiveQuizBlockProps {
  className?: string
  active: boolean
  block: QuizTimelineBlock
  setBlockClosureModal: Dispatch<SetStateAction<boolean>>
}

const ICON_MAP = {
  [ElementBlockStatus.Executed]: faCheck,
  [ElementBlockStatus.Scheduled]: faCalendar,
  [ElementBlockStatus.Active]: faSync,
}

function LiveQuizBlock({
  className,
  active,
  block,
  setBlockClosureModal,
}: LiveQuizBlockProps): React.ReactElement {
  const t = useTranslations()
  const [inCooldown, setInCooldown] = useState(false)

  return (
    <div
      className={twMerge(
        className,
        'bg-uzh-grey-40 min-w-max rounded p-4',
        active && 'bg-green-300',
        inCooldown && 'bg-orange-200'
      )}
    >
      <div
        className={twMerge(
          'flex min-w-max flex-row items-center justify-between text-gray-700'
        )}
      >
        <div className="mr-2">
          <FontAwesomeIcon icon={ICON_MAP[block.status]} />
        </div>
        {typeof block.numOfParticipants !== 'undefined' &&
        block.numOfParticipants !== null ? (
          <div className="flex flex-row items-center">
            <span className="font-bold">
              {t('shared.generic.blockN', {
                number: block.order! + 1,
              })}
            </span>
            <span className="ml-1">{` - ${block.numOfParticipants}`}</span>
            <FontAwesomeIcon icon={faUserGroup} className="ml-1 w-4" />
          </div>
        ) : (
          <div>{t('shared.generic.blockN', { number: block.order! + 1 })}</div>
        )}

        {block.timeLimit && (
          <LiveQuizCountdown
            block={block}
            inCooldown={inCooldown}
            onExpiration={() => setBlockClosureModal(false)}
            setInCooldown={setInCooldown}
          />
        )}
      </div>
      {block.elements?.map((instance) => (
        <div key={instance.id}>
          <Link
            href={`/instances/${instance.id}`}
            className="text-sm hover:text-slate-700"
            legacyBehavior
            passHref
          >
            <a
              data-cy={`open-question-live-quiz-${instance.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {instance.elementData.name}{' '}
              <FontAwesomeIcon className="ml-1 text-xs" icon={faExternalLink} />
            </a>
          </Link>
        </div>
      ))}
    </div>
  )
}

export default LiveQuizBlock
