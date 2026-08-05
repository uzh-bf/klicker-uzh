import {
  faCalendar,
  faCheck,
  faExternalLink,
  faSync,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementBlockStatus,
  type ElementBlock as ElementBlockType,
  type ElementInstance,
} from '@klicker-uzh/graphql/dist/ops'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type React from 'react'
import { type Dispatch, type SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LiveQuizCountdown from './LiveQuizCountdown'

type QuizTimelineInstance = Omit<ElementInstance, 'elementData'> & {
  elementData: { elementId: number | null; name: string }
}

export type QuizTimelineBlock = Omit<ElementBlockType, 'elements'> & {
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
      {block.elements?.map((instance) => {
        const numOfResponsesReceived = instance.numOfResponsesReceived
        const numOfResponsesProcessed = instance.numOfResponsesProcessed
        const hasResponseCounts =
          numOfResponsesReceived !== null &&
          typeof numOfResponsesReceived !== 'undefined' &&
          numOfResponsesProcessed !== null &&
          typeof numOfResponsesProcessed !== 'undefined'

        return (
          <div key={instance.id}>
            <Link
              href={`/instances/${instance.id}`}
              className="text-sm hover:text-slate-700"
              data-cy={`open-question-live-quiz-${instance.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {instance.elementData!.name}{' '}
              <FontAwesomeIcon className="ml-1 text-xs" icon={faExternalLink} />
            </Link>
            {hasResponseCounts ? (
              <span
                className="ml-2 whitespace-nowrap text-xs text-gray-600"
                data-cy={`live-quiz-response-counts-${instance.id}`}
              >
                {t('manage.cockpit.responsesReceived', {
                  number: numOfResponsesReceived,
                })}
                <span aria-hidden="true"> · </span>
                {t('manage.cockpit.responsesProcessed', {
                  number: numOfResponsesProcessed,
                })}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default LiveQuizBlock
