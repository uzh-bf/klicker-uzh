import {
  faArrowRight,
  faCalendar,
  faCheck,
  faCheckDouble,
  faExternalLink,
  faInbox,
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
        'bg-uzh-grey-40 min-w-44 max-w-full flex-1 rounded p-4',
        active && 'bg-green-300',
        inCooldown && 'bg-orange-200'
      )}
    >
      <div
        className={twMerge(
          'flex min-w-0 flex-row items-center justify-between text-gray-700'
        )}
      >
        <div className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
          <FontAwesomeIcon
            icon={ICON_MAP[block.status]}
            className="block h-3.5 w-3.5"
          />
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
            <FontAwesomeIcon
              icon={faUserGroup}
              className="ml-1 block h-3 w-3 shrink-0"
            />
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
      <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-baseline gap-x-3">
        {block.elements?.map((instance) => {
          const numOfResponsesReceived = instance.numOfResponsesReceived
          const numOfResponsesProcessed = instance.numOfResponsesProcessed
          const hasResponseCounts =
            numOfResponsesReceived !== null &&
            typeof numOfResponsesReceived !== 'undefined' &&
            numOfResponsesProcessed !== null &&
            typeof numOfResponsesProcessed !== 'undefined'
          const responseCountLabel = hasResponseCounts
            ? `${t('manage.cockpit.responsesReceived', {
                number: numOfResponsesReceived,
              })} · ${t('manage.cockpit.responsesProcessed', {
                number: numOfResponsesProcessed,
              })}`
            : undefined

          return (
            <div key={instance.id} className="contents">
              <Link
                href={`/instances/${instance.id}`}
                className="min-w-0 text-sm hover:text-slate-700"
                data-cy={`open-question-live-quiz-${instance.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {instance.elementData!.name}{' '}
                <FontAwesomeIcon
                  className="ml-1 inline-block h-3 w-3 align-middle"
                  icon={faExternalLink}
                />
              </Link>
              {hasResponseCounts ? (
                <span
                  aria-label={responseCountLabel}
                  className="inline-flex h-5 items-center justify-end gap-1 whitespace-nowrap rounded bg-black/5 px-1.5 py-0.5 text-xs leading-none text-gray-700 tabular-nums"
                  data-cy={`live-quiz-response-counts-${instance.id}`}
                  role="img"
                  title={responseCountLabel}
                >
                  <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center">
                    <FontAwesomeIcon
                      aria-hidden="true"
                      className="block h-3 w-3 text-gray-500"
                      icon={faInbox}
                    />
                  </span>
                  <span aria-hidden="true">{numOfResponsesReceived}</span>
                  <span className="mx-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center">
                    <FontAwesomeIcon
                      aria-hidden="true"
                      className="block h-2.5 w-2.5 text-gray-400"
                      icon={faArrowRight}
                    />
                  </span>
                  <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center">
                    <FontAwesomeIcon
                      aria-hidden="true"
                      className="block h-3 w-3 text-gray-500"
                      icon={faCheckDouble}
                    />
                  </span>
                  <span aria-hidden="true">{numOfResponsesProcessed}</span>
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LiveQuizBlock
